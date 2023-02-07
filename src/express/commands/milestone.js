/* eslint-disable dot-notation */
import { promises } from 'fs-extra'
import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import { timer } from '../common/time-utils'

const {
  runScpCommand,
  runSshCommand,
  maxRetries,
  runSshCommandWithoutExit,
  runSshCommandWithReturn
} = require('../common/remote-worker')

async function removeAllPeers(ip, staticNodes) {
  let command = 'mv ~/.bor/static-nodes.json ~/.bor/static-nodes.json_bkp'
  try {
    await runSshCommandWithoutExit(ip, command, 1)
  } catch (error) {
    console.log('static-nodes.json already moved')
  }

  const tasks = []
  for (let i = 0; i < staticNodes.length; i++) {
    command = `/home/ubuntu/go/bin/bor attach ~/.bor/data/bor.ipc --exec "admin.removeTrustedPeer('${staticNodes[i]}')"`
    tasks.push(runSshCommand(ip, command, maxRetries))

    command = `/home/ubuntu/go/bin/bor attach ~/.bor/data/bor.ipc --exec "admin.removePeer('${staticNodes[i]}')"`
    tasks.push(runSshCommand(ip, command, maxRetries))
  }
  console.log('📍Removing all peers')
  await Promise.all(tasks)
  console.log('📍Removed all peers')
}

async function addAllPeers(ip, staticNodes) {
  const tasks = []
  for (let i = 0; i < staticNodes.length; i++) {
    const command = `/home/ubuntu/go/bin/bor attach ~/.bor/data/bor.ipc --exec "admin.addPeer('${staticNodes[i]}')"`
    tasks.push(runSshCommand(ip, command, maxRetries))
  }
  console.log('📍Adding all peers')
  await Promise.all(tasks)
  console.log('📍Added all peers')
}

async function removePeers(ip, peers) {
  let tasks = []
  for (let i = 0; i < peers.length; i++) {
    let command = `~/go/bin/bor attach ~/.bor/data/bor.ipc --exec "admin.removePeer('${peers[i]}')"`
    tasks.push(runSshCommand(ip, command, maxRetries))
  }

  await Promise.all(tasks).catch(error => {
    return false
  }).then(() => {
    return true
  })
}

async function getPeerLength(ip) {
  const command = `/home/ubuntu/go/bin/bor attach ~/.bor/data/bor.ipc --exec "admin.peers.length"`
  try {
    let length = await runSshCommandWithReturn(ip, command, maxRetries)
    return parseInt(length)
  } catch (error) {
    console.log('📍unable to query peer length')
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

  await Promise.all(tasks).then((values) => {
    if (values.includes(false)) {
      console.log('📍Unable to remove peers for creating cluster, exiting')
      return false
    }
  }).catch(error => {
    return false
  })

  return true
}

async function getEnode(ip) {
  let command = '~/go/bin/bor attach ~/.bor/data/bor.ipc --exec admin.nodeInfo.enode'
  try {
    const fullEnode = await runSshCommandWithReturn(ip, command, maxRetries)
    let enode = string(fullEnode).split('@')[0]; // remove the local ip from the enode
    if (enode.length != 136) { // prefix "enode://" + 128 hex values for enode itself
      return ''
    }
    enode += "@" + ip + ":30303" // assuming that p2p port is opened on 30303 
    return enode
  } catch (error) {
    console.log('unable to query enode')
  }

  return ''
}

function validateNumberOfPeers(peers, total) {
  let recreate = false

  // 1st node should have 0 peers
  if (peers[0] > 0) {
    console.log('📍Unexpected peer length received for 1st cluster, retrying. expected: 0, received:', peers[0])
    recreate = true
  }

  // Remaining nodes should have total-1 peers
  for (let i = 1; i < length(peers); i++) {
    if (peers[i] != total - 1) {
      console.log('📍Unexpected peer length received for 2nd cluster, retrying')
      recreate = true
      break
    }
  }

  return recreate
}

export async function milestone() {
  console.log('📍Command --milestone')

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
  
  

  // Wait for milestone
  // Re-join them and check if the final chain is of majority (2/3+1) cluster
  // End tests

  // Grab the enode of all the nodes
  let enodes = []
  let tasks = []
  let ips = []
  for (let i = 0; i < borUsers; i++) {
    const ip = `${borUsers[i]}@${borHosts[i]}`
    ips.push(ip)
    tasks.push(getEnode(ip))
  }

  await Promise.all(tasks).then((values) => {
    enode = values
  })

  if (enodes.includes('')) {
    console.log('📍Unable to fetch enode, exiting')
    return
  }

  // Next step is to create 2 clusters where primary node is separated from the
  // rest of the network.
  let created = await createClusters(ips, enodes)
  if (!created) {
    console.log('📍Unable to remove peers for creating clusters exiting')
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

  let recreate = validateNumberOfPeers(peers, ips.length)  
  if (recreate) {
    console.log('📍Retrying creation of partition clusters for testing')
    created = await createClusters(ips, enodes)
    if (!created) {
      console.log('📍Unable to remove peers for creating clusters exiting')
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

    recreate = validateNumberOfPeers(peers, ips.length)
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


}
