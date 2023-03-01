import { checkLatestMilestone } from '../commands/monitor'
import { timer } from './time-utils'

const {
  runSshCommand,
  maxRetries,
  runSshCommandWithReturn,
  runCommand
} = require('../common/remote-worker')

export async function getBlock(ip, number = 'latest') {
  const url = `http://${ip}:8545`
  if (number != 'latest' && number != 'finalized') {
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
    // console.log(`📍Request. number: ${number}, opts: ${JSON.stringify(opts)}`)
    return responseJson.result
  } else {
    console.log(`📍Error fetching block. number: ${number}, opts: ${JSON.stringify(opts)}`)
    console.log(`📍Response received:`, responseJson)
  }

  return undefined
}

async function getValidatorInfo(ip) {
  const command = 'echo `cat $HOME/matic-cli/devnet/code/genesis-contracts/validators.json`'
  try {
    let validators = await runSshCommandWithReturn(ip, command, maxRetries)
    return JSON.parse(validators)
  } catch (error) {
    console.log('📍Unable to get validator info, error:', error)
  }

  return undefined
}

export async function validateProposer(ip, proposer) {
  let validators = await getValidatorInfo(ip)
  try {
    if (validators) {
      // Skip the validator from cluster 1
      for (let i = 1; i < validators.length; i++) {
        if (String(proposer).toLowerCase() == String(validators[i].address).toLowerCase()) {
          console.log(`📍Validated milestone proposer`)
          return
        }
      }

      console.log('📍Invalid milestone got proposed from validator/s of cluster 1')
      console.log('📍Milestone proposer:', proposer, ", validators: ", validators)
    }
  } catch (error) {
    console.log('📍Error in validating milestone proposer, skipping check. Error:', error)
  }
}

export async function removePeers(ip, peers) {
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

export async function joinAllPeers(ips, enodes) {
  let tasks = []
  for (let i = 0; i < ips.length; i++) {
    tasks.push(addPeers(ips[i], enodes))
  }

  await Promise.all(tasks).then((values) => {
    if (values.includes(false) || values.includes(undefined)) {
      console.log('📍Failed to add peers for rejoining clusters')
      return false
    }
  })

  // Validate by fetching peer length
  tasks = []
  for (let i = 0; i < ips.length; i++) {
    tasks.push(getPeerLength(ips[i]))
  }

  let lengths
  await Promise.all(tasks).then((values) => {
    lengths = values
  })

  if (!lengths) {
    await timer(100)
    if (!lengths) {
      return false
    }
  }

  if (lengths.includes(-1)) {
    console.log('📍Unable to query peer length, exiting')
    return false
  }

  console.log('📍Peer length:', lengths)
  return true
}

export async function createClusters(ips, enodes, split = 1) {
  // `split` defines how clusters are created and which index to use to seperate nodes. 
  // e.g. for split = 1, clusters created would be of 1 and 3 nodes (nodes[:split], nodes[split:])
  let tasks = []
  let ips1 = ips.slice(0, split)
  let ips2 = ips.slice(split)
  for (let i = 0; i < ips1.length; i++) {
    tasks.push(removePeers(ips1[i], enodes.slice(split)))
  }
  for (let i = 0; i < ips2.length; i++) {
    tasks.push(removePeers(ips2[i], enodes.slice(0, split)))
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

export async function rejoinClusters(ips, enodes, split = 1) {
  // `split` defines how clusters are joined and which index to use to join nodes. 
  // e.g. for split = 1, clusters of 1 and 3 nodes would be joined (nodes[:split], nodes[split:])
  let tasks = []
  for (let i = 0; i < ips.slice(0, split); i++) {
    tasks.push(addPeers(ips[i], enodes.slice(split)))
  }
  for (let i = 0; i < ips.slice(split); i++) {
    tasks.push(addPeers(ips[i], enodes.slice(0, split)))
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

export async function validateNumberOfPeers(peers) {
  let recreate = false

  // 1st node should have 0 peers
  if (peers[0] > 0) {
    console.log('📍Unexpected peer length received for 1st cluster, retrying')
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

export async function validateFinalizedBlock(hosts, milestone) {
  // Fetch the last 'finalized' block from all nodes
  let tasks = []
  for (let i = 0; i < hosts.length; i++) {
    tasks.push(runCommand(getBlock, hosts[i], 'finalized', maxRetries))    
  }

  let finalizedBlocks = []
  await Promise.all(tasks).then((values) => {
    // Check if there's empty value
    if (values.includes(undefined)) {
      console.log(`📍Error in fetching last finalized block, responses: ${values}, exiting`)
      return false
    }
    finalizedBlocks = values
  })

  // if (finalizedBlocks.length != hosts) {
  //   await timer(500)
  //   if (finalizedBlocks.length != hosts) {
  //     return false
  //   }
  // } 
  await timer(100)

  // Check if the number and hash matches with the last milestone
  for (let i = 0; i < finalizedBlocks.length; i++) {
    if (Number(finalizedBlocks[i].number) != Number(milestone.end_block) || finalizedBlocks[i].hash != milestone.hash) {
      console.log(`📍Block number or hash mismatch for finalized block. Host index: ${i}, Finalized Block Number: ${Number(finalizedBlocks[i].number)}, Hash: ${finalizedBlocks[i].hash}. Milestone end block: ${Number(milestone.end_block)}, Hash: ${milestone.hash} exiting`)
      return false
    }
  }

  return true
}

export async function fetchLatestMilestone(milestoneLength, queryTimer, host, lastMilestone = undefined) {
  let milestone
  let count = 0
  console.log('📍Querying heimdall for next milestone...')
  while (true) {
    if (count != 0) {
      await timer(queryTimer)
    }
    count++

    if (count > milestoneLength) {
      console.log(`📍Unable to fetch milestone from heimdall after ${count} tries`)
      return undefined
    }

    milestone = await checkLatestMilestone(host)
    if (milestone.result) {
      // Check against last milestone (if present) if it's immediate next one or not
      if (lastMilestone) {
        if (Number(milestone.result.start_block) == Number(lastMilestone.end_block) + 1) {
          break
        } else {
          console.log('📍Waiting for new milestone...')
          continue
        }
      }
      break
    } else {
      console.log(`📍Invalid milestone received. Response: ${JSON.stringify(milestone.result)}, count: ${count}`) 
    }
  }

  let latestMilestone = milestone.result
  console.log(`📍Got milestone from heimdall. Start block: ${Number(latestMilestone.start_block)}, End block: ${Number(latestMilestone.end_block)}, ID: ${latestMilestone.milestone_id}`)
  return latestMilestone
}
