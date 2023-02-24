const {
  runSshCommand,
  maxRetries,
  runSshCommandWithReturn
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

export async function getValidatorInfo(ip) {
  const command = 'echo `cat $HOME/matic-cli/devnet/code/genesis-contracts/validators.json`'
  try {
    let validators = await runSshCommandWithReturn(ip, command, maxRetries)
    return JSON.parse(validators)
  } catch (error) {
    console.log('📍Unable to get validator info, error:', error)
  }

  return undefined
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

export async function createClusters(ips, enodes) {
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

export async function rejoinClusters(ips, enodes) {
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

export function validateNumberOfPeers(peers) {
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
