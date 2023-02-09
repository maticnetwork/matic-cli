// noinspection JSCheckFunctionSignatures,JSUnresolvedFunction,JSUnresolvedVariable

import { loadDevnetConfig } from '../common/config-utils'
import { timer } from '../common/time-utils'

const fetch = require('node-fetch')
const Web3 = require('web3')
const { runScpCommand, maxRetries } = require('../common/remote-worker')

const lastStateIdABI = [
  {
    constant: true,
    inputs: [],
    name: 'lastStateId',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  }
]

const currentHeaderBlockABI = [
  {
    constant: true,
    inputs: [],
    name: 'currentHeaderBlock',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  }
]

const stateReceiverAddress = '0x0000000000000000000000000000000000001001'

async function checkCheckpoint(ip) {
  const url = `http://${ip}:1317/checkpoints/count`
  const response = await fetch(url)
  const responseJson = await response.json()
  if (responseJson.result) {
    if (responseJson.result.result) {
      return responseJson.result.result
    }
  }

  return 0
}

export async function checkLatestMilestone(ip) {
  const url = `http://${ip}:1317/milestone/latest`
  const response = await fetch(url)
  return responseJson = await response.json()
}

async function checkStateSyncTx(ip, id) {
  const url = `http://${ip}:1317/clerk/event-record/${id}`
  const response = await fetch(url)
  const responseJson = await response.json()
  if (responseJson.error) {
    return undefined
  } else {
    if (responseJson.result) {
      return responseJson.result
    }
  }

  return undefined
}

async function getStateSyncTxList(ip, startTime, endTime) {
  const url = `http://${ip}:1317/clerk/event-record/list?from-time=${startTime}&to-time=${endTime}&page=1&limit=200`
  const response = await fetch(url)
  const responseJson = await response.json()
  if (responseJson.error) {
    return undefined
  } else {
    if (responseJson.result) {
      return responseJson.result
    }
  }

  return undefined
}

async function lastStateIdFromBor(ip) {
  const web3 = new Web3(`http://${ip}:8545`)

  const StateReceiverContract = await new web3.eth.Contract(
    lastStateIdABI,
    stateReceiverAddress
  )
  return await StateReceiverContract.methods.lastStateId().call()
}

async function getLatestCheckpointFromRootChain(ip, rootChainProxyAddress) {
  const web3 = new Web3(`http://${ip}:9545`)

  const RootChainContract = await new web3.eth.Contract(
    currentHeaderBlockABI,
    rootChainProxyAddress
  )
  const currentHeaderBlock = await RootChainContract.methods
    .currentHeaderBlock()
    .call()
  return currentHeaderBlock.toString().slice(0, -4)
}

export async function monitor() {
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)

  if (doc.devnetBorHosts.length > 0) {
    console.log('📍Monitoring the first node', doc.devnetBorHosts[0])
  } else {
    console.log('📍No nodes to monitor, please check your configs! Exiting...')
    process.exit(1)
  }

  const machine0 = doc.devnetBorHosts[0]
  console.log('📍Checking for StateSyncs && Checkpoints')

  const src = `${doc.ethHostUser}@${machine0}:~/matic-cli/devnet/code/contracts/contractAddresses.json`
  const dest = './contractAddresses.json'
  await runScpCommand(src, dest, maxRetries)

  const contractAddresses = require(`${process.cwd()}/contractAddresses.json`)

  const rootChainProxyAddress = contractAddresses.root.RootChainProxy

  // noinspection InfiniteLoopJS
  while (true) {
    await timer(1000)
    console.log()

    const checkpointCount = await checkCheckpoint(machine0)
    if (checkpointCount > 0) {
      console.log(
        '📍Checkpoint found on Heimdall ✅ ; Count: ',
        checkpointCount
      )
    } else {
      console.log('📍Awaiting Checkpoint on Heimdall 🚌')
    }

    const checkpointCountFromRootChain = await getLatestCheckpointFromRootChain(
      machine0,
      rootChainProxyAddress
    )
    if (checkpointCountFromRootChain > 0) {
      console.log(
        '📍Checkpoint found on Root chain ✅ ; Count: ',
        checkpointCountFromRootChain
      )
    } else {
      console.log('📍Awaiting Checkpoint on Root chain 🚌')
    }

    const firstStateSyncTx = await checkStateSyncTx(machine0, 1)
    let stateSyncTxList
    if (firstStateSyncTx) {
      const timeOfFirstStateSyncTx = firstStateSyncTx.record_time
      const firstEpochTime = parseInt(
        new Date(timeOfFirstStateSyncTx).getTime() / 1000
      )
      const currentEpochTime = parseInt(new Date().getTime() / 1000)
      stateSyncTxList = await getStateSyncTxList(
        machine0,
        firstEpochTime,
        currentEpochTime
      )
      if (stateSyncTxList) {
        const lastStateID = stateSyncTxList.length
        const lastStateSyncTxHash = stateSyncTxList[lastStateID - 1].tx_hash
        console.log(
          '📍StateSyncs found on Heimdall ✅ ; Count: ',
          lastStateID,
          ' ; Last Tx Hash: ',
          lastStateSyncTxHash
        )
      }
    } else {
      console.log('📍Awaiting StateSync 🚌')
    }

    const lastStateId = await lastStateIdFromBor(machine0)
    if (lastStateId) {
      console.log('📍LastStateId on Bor: ', lastStateId)
    } else {
      console.log('📍Unable to fetch LastStateId ')
    }
  }
}
