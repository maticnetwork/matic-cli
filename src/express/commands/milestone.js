/* eslint-disable dot-notation */
import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import { timer } from '../common/time-utils'
import { checkLatestMilestone } from './monitor';

const {
  runSshCommand,
  maxRetries,
  runCommand,
  runSshCommandWithReturn
} = require('../common/remote-worker')

const milestoneLength = 64
const queryTimer = (milestoneLength / 4) * 1000

export async function getBlock(ip, number = 'latest') {
  const url = `http://${ip}:8545`
  if (number != 'latest' && number != 'pending') {
    number = '0x' + Number(number).toString(16) // hexify
  }

  const opts = {
    'jsonrpc':'2.0',
    'id':1,
    'method':'eth_getBlockByNumber',
    'params':[number, false],
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(opts)
  })
  
  const responseJson = await response.json()
  if (responseJson.result) {
    return responseJson.result
  } else {
    console.log(`📍Error fetching block. number: ${number}, response: ${JSON.stringify(response)}, opts: ${JSON.stringify(opts)}`)
  }

  return undefined
}

async function removePeers(ip, peers) {
  let tasks = []
  for (let i = 0; i < peers.length; i++) {
    let command = `~/go/bin/bor attach ~/.bor/data/bor.ipc --exec "admin.removePeer('${peers[i]}')"`
    tasks.push(runSshCommand(ip, command, maxRetries))
  }

  let response = false
  await Promise.all(tasks).then(() => {
    response = true
  }).catch((error) => {
    console.log('📍Unable to remove peers, error:', error)
  })

  return response
}

export async function addPeers(ip, peers) {
  let tasks = []
  for (let i = 0; i < peers.length; i++) {
    let command = `~/go/bin/bor attach ~/.bor/data/bor.ipc --exec "admin.addPeer('${peers[i]}')"`
    tasks.push(runSshCommand(ip, command, maxRetries))
  }

  let response = false
  await Promise.all(tasks).then(() => {
    response = true   
  }).catch((error) => {
    console.log('📍Unable to add peers, error:', error)
  })

  return response
}

export async function getPeerLength(ip) {
  const command = `/home/ubuntu/go/bin/bor attach ~/.bor/data/bor.ipc --exec "admin.peers.length"`
  try {
    let length = await runSshCommandWithReturn(ip, command, maxRetries)
    return parseInt(length)
  } catch (error) {
    console.log('📍Unable to query peer length, error:', error)
  }

  return -1
}

async function createClusters(ips, enodes) {
  let tasks = []
  for (let i = 0; i < ips.length; i++) {
    if (i == 0) {
      // remove all other peers from 1st node
      tasks.push(removePeers(ips[i], enodes.slice(1)))
    } else {
      // remove 1st node from all peers
      tasks.push(removePeers(ips[i], [enodes[0]]))
    }
  }

  let response = false
  await Promise.all(tasks).then((values) => {
    if (values.includes(false) || values.includes(undefined)) {
      console.log('📍Unable to remove peers, exiting')
    } else {
      response = true
    }
  }).catch(error => {
    console.log('📍Unable to remove peers, error:', error)
  })

  return response
}

async function rejoinClusters(ips, enodes) {
  let tasks = []
  for (let i = 0; i < ips.length; i++) {
    if (i == 0) {
      // add all other peers in 1st node
      tasks.push(addPeers(ips[i], enodes.slice(1)))
    } else {
      // add 1st node in all peers
      tasks.push(addPeers(ips[i], [enodes[0]]))
    }
  }

  let response = false
  await Promise.all(tasks).then(values => {
    if (values.includes(false) || values.includes(undefined)) {
      console.log('📍Unable to add peers, exiting')
    } else {
      response = true
    }
  }).catch(error => {
    console.log("📍Unable to add peers, error", error)
  })
  
  return response
}

export async function getEnode(user, host) {
  const ip = `${user}@${host}`
  let command = '~/go/bin/bor attach ~/.bor/data/bor.ipc --exec admin.nodeInfo.enode'
  try {
    const fullEnode = await runSshCommandWithReturn(ip, command, maxRetries)
    let enode = String(fullEnode).split('@')[0].slice(1); // remove the local ip from the enode
    if (enode.length != 136) { // prefix "enode://" + 128 hex values for enode itself
      return ''
    }
    enode += "@" + host + ":30303" // assuming that p2p port is opened on 30303 
    return enode
  } catch (error) {
    console.log(`📍Unable to query enode. Error: ${error}`)
  }

  return ''
}

function validateNumberOfPeers(peers) {
  let recreate = false

  // 1st node should have 0 peers
  if (peers[0] > 0) {
    console.log('📍Unexpected peer length received for 1st cluster, retrying. expected: 0, received:', peers[0])
    recreate = true
  }

  // Remaining nodes should have total-1 peers
  for (let i = 1; i < peers.length; i++) {
    if (peers[i] != (peers.length - 2)) {
      console.log('📍Unexpected peer length received for 2nd cluster, retrying')
      recreate = true
      break
    }
  }

  return recreate
}

export async function milestone() {
  // NOTE: Make sure bor branch has logic for hardcoded primary validator
  
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)

  const borUsers = splitToArray(doc['devnetBorUsers'].toString())
  const borHosts = splitToArray(doc['devnetBorHosts'].toString())

  // Check for number of validators
  if (doc['numOfValidators'].length < 4) {
    console.log('📍Cannot run milestone tests on less than 4 validator nodes')
    process.exit(1)
  }

  // Grab the enode of all the nodes
  let enodes = []
  let tasks = []
  let ips = []
  for (let i = 0; i < borUsers.length; i++) {
    const ip = `${borUsers[i]}@${borHosts[i]}`
    ips.push(ip)
    tasks.push(getEnode(borUsers[i], borHosts[i]))
  }

  console.log("ips:", ips)

  await Promise.all(tasks).then((values) => {
    enodes = values
  })

  if (enodes.includes('')) {
    console.log('📍Unable to fetch enode, exiting')
    return
  }

  // Wait for a milestone to get proposed for verification
  let count = 0
  console.log('📍Querying heimdall for next milestone...')
  let milestone;
  while (true) {
    if (count > milestoneLength) {
      console.log('📍Unable to fetch milestone from heimdall, exiting')
      return
    }

    milestone = await checkLatestMilestone(borHosts[0])
    if (milestone.result) {
      break
    } else {
      console.log(`📍Invalid milestone received. Response: ${JSON.stringify(milestone.result)}, count: ${count}`) 
    }

    count++
    await timer(queryTimer)
  }

  let lastMilestone = milestone.result

  console.log(`📍Got milestone from heimdall. Start block: ${Number(lastMilestone.start_block)}, End block: ${Number(lastMilestone.end_block)}, ID: ${lastMilestone.milestone_id}`)
  console.log('📍Rejoining clusters before performing tests')
 
  // Make sure all peers are joined
  let rejoined = await rejoinClusters(ips, enodes)
  if (!rejoined) {
    console.log('📍Unable to add peers before starting tests, exiting')
    return
  }
  console.log('📍Rejoined clusters')

  // Fetch the last 'finalized' block
  // process.stdout.write("Writing data");
  console.log('📍Trying to fetch last finalized block')
  let finalizedBlock = await runCommand(getBlock, borHosts[0], "finalized", maxRetries)
  if (finalizedBlock == undefined) {
    console.log('📍Unable to fetch last finalized block, exiting')
    return
  }

  // Check if the number and hash matches with the last milestone
  if (Number(finalizedBlock.Number) == Number(lastMilestone.end_block) && finalizedBlock.hash == lastMilestone.hash) {
    console.log('📍Received correct finalized block according to last milestone')
  } else {
    console.log(`📍Block number or hash mismatch for finalized block. Finalized Block Number: ${Number(finalizedBlock.Number)}, Hash: ${Number(finalizedBlock.hash)}. Milestone end block: ${lastMilestone.end_block}, Hash: ${lastMilestone.hash} exiting`)
    return
  }

  console.log('📍Creating clusters for tests')

  // Next step is to create 2 clusters where primary node is separated from the
  // rest of the network.
  let created = await createClusters(ips, enodes)
  if (!created) {
    console.log('📍Unable to remove peers for creating clusters, exiting')
    return
  }

  // Validate if the cluster is created by number of peers
  tasks = []
  for (let i = 0; i < ips.length; i++) {
    tasks.push(getPeerLength(ips[i]))    
  }

  
  let peers = []
  await Promise.all(tasks).then((values) => {
    // Check if there's no validation error
    if (values.includes(-1)) {
      console.log('📍Unable to query peer length, exiting')
      return
    }
    peers = values
  })

  let recreate = validateNumberOfPeers(peers)  
  if (recreate) {
    console.log('📍Retrying creation of partition clusters for testing')
    created = await createClusters(ips, enodes)
    if (!created) {
      console.log('📍Unable to remove peers for creating clusters, exiting')
      return
    }

    // Validate if the cluster is created by number of peers
    tasks = []
    for (let i = 0; i < ips.length; i++) {
      tasks.push(getPeerLength(ips[i]))    
    }

    let peers = []
    await Promise.all(tasks).then((values) => {
      // Check if there's no validation error
      if (values.includes(-1)) {
        console.log('📍Unable to query peer length, exiting')
        return
      }
      peers = values
    })

    recreate = validateNumberOfPeers(peers)
    if (recreate) {
      console.log('📍Failed to create partition clusters for testing, exiting')
    } else {
      console.log('📍Partition clusters for testing created. Proceeding to test')
    }
  } else {
    console.log('📍Partition clusters for testing created. Proceeding to test')
  }

  // Reaching this step means that we've created 2 clusters for testing. 
  // Cluster 1 has a single primary producer whose difficulty should always be higher. 
  // Cluster 2 should have remaining nodes (with 2/3+1 stake) all with difficulty lower than node 1
  // and nodes performing mining out of sync. 
  await timer(2000)

  // Validate if both the clusters are on their own chain. 
  console.log('📍Trying to fetch latest block from both clusters')
  
  // We'll fetch block from cluster 2 first as it'll be behind in terms of block height
  let latestBlockCluster2 = await runCommand(getBlock, borHosts[1], "latest", maxRetries)
  if (latestBlockCluster2 == undefined) {
    console.log('📍Unable to fetch latest block in cluster 2, exiting')
    return
  }

  if (latestBlockCluster2.number) {
    console.log(`📍Trying to fetch block ${latestBlockCluster2.number} from cluster 1`)
    let latestBlockCluster1 = await runCommand(getBlock, borHosts[0], latestBlockCluster2.number, maxRetries)
    if (latestBlockCluster1 == undefined) {
      console.log(`📍Unable to fetch block ${Number(latestBlockCluster2.number)} in cluster 1, exiting`)
      return
    }

    if (latestBlockCluster1.number) {
      if (latestBlockCluster1.number != latestBlockCluster2.number) {
        console.log(`📍Block number mismatch from clusters. Cluster 1: ${Number(latestBlockCluster1.number)}, Cluster 2: ${Number(latestBlockCluster2.number)}, exiting`)
        return
      }

      // Check if same block numbers have different hash or not
      if (latestBlockCluster1.hash == latestBlockCluster2.hash) {
        console.log(`📍Block hash matched. Clusters are not created properly. Cluster 1: ${latestBlockCluster1.hash}, Cluster 2: ${latestBlockCluster2.hash}, exiting`)
        return
      }

      console.log(`📍Same block found with different hash. Block number: ${Number(latestBlockCluster1.number)}, Cluster 1 hash: ${latestBlockCluster1.hash}, Cluster 2 hash: ${latestBlockCluster2.hash}`)
    } else {
      console.log('📍Unable to fetch latest block from 1st cluster, exiting')
      return
    }
  } else {
    console.log('📍Unable to fetch latest block from 2nd cluster, exiting')
    return
  }
  
  // Wait for the next milestone to get proposed for verification
  count = 0
  console.log('📍Querying heimdall for next milestone...')
  while (true) {
    if (count > milestoneLength) {
      console.log('📍Unable to fetch milestone from heimdall, exiting')
      return
    }

    milestone = await checkLatestMilestone(borHosts[0])
    if (milestone.result) {
      // Check if the milestone is the immediate next one or not
      if (Number(milestone.result.start_block) == Number(lastMilestone.end_block) + 1) {
        break
      }
      console.log('📍Waiting for new milestone...')
    } else {
      console.log(`📍Invalid milestone received. Response: ${JSON.stringify(milestone.result)}, count: ${count}`) 
    }

    count++
    await timer(queryTimer)
  }

  let latestMilestone = milestone.result
  console.log(`📍Got milestone from heimdall. Start block: ${Number(latestMilestone.start_block)}, End block: ${Number(latestMilestone.end_block)}, ID: ${latestMilestone.milestone_id}`)

  // Validate if the proposer of the milestone is someone from 2nd cluster

  // Reconnect both the clusters
  rejoined = await rejoinClusters(ips, enodes)
  if (!rejoined) {
    console.log('📍Unable to add peers while rejoining clusters, exiting')
    return
  }

  // Wait for few seconds for reorg to happen
  console.log('📍Waiting for clusters to connect and reorg...')
  await timer(4000)

  // Fetch block from cluster 1 to see if it got reorged to cluster 2
  console.log(`📍Fetching block ${Number(latestBlockCluster2.number)} from cluster 1`)
  let latestBlockCluster1 = await runCommand(getBlock, borHosts[0], latestBlockCluster2.number, maxRetries)
  if (latestBlockCluster1 == undefined) {
    console.log(`📍Unable to fetch block ${Number(latestBlockCluster2.number)} in cluster 1, exiting`)
    return
  }
  
  if (latestBlockCluster1.number) {
    if (latestBlockCluster1.hash == latestBlockCluster2.hash) {
      console.log('Cluster 1 successfully reorged to cluster 2 (with high majority)')
    } else {
      console.log(`📍Hash mismatch among clusters. Cluster 1 hash: ${latestBlockCluster1.hash}, Cluster 2 hash: ${latestBlockCluster2.hash}, exiting`)
      return
    }
  } else {
    console.log('📍Unable to fetch latest block from 1st cluster, exiting')
    return
  }

  // Fetch the last 'finalized' block from all nodes
  tasks = []
  console.log('📍Trying to fetch last finalized block from all nodes and validate')
  for (let i = 0; i < borHosts.length; i++) {
    tasks.push(runCommand(getBlock, borHosts[i], 'finalized', maxRetries))    
  }

  let finalizedBlocks = []
  await Promise.all(tasks).then((values) => {
    // Check if there's empty value
    if (values.includes(undefined)) {
      console.log(`📍Error in fetching last finalized block, responses: ${values}, exiting`)
      return
    }
    finalizedBlocks = values
  })

  // Check if the number and hash matches with the last milestone
  for (let i = 0; i < finalizedBlocks.length; i++) {
    if (Number(finalizedBlocks[i].Number) != Number(latestMilestone.end_block) || finalizedBlocks[i].hash != latestMilestone.hash) {
      console.log(`📍Block number or hash mismatch for finalized block. Host index: ${i}, Finalized Block Number: ${Number(finalizedBlocks[i].Number)}, Hash: ${Number(finalizedBlocks[i].hash)}. Milestone end block: ${latestMilestone.end_block}, Hash: ${latestMilestone.hash} exiting`)
      return
    }
  }

  console.log('📍Finalized block matches with the last milestone')
  console.log('✅ Test Passed')
}
