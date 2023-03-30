import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import Web3 from 'web3'

const fs = require('fs')
require('dotenv').config()

// print function, so that only 0th index node prints the logs
function print(text, index) {
  if (index === 0) {
    console.log(text)
  }
}

// web3 library initialization
async function initWeb3(provider) {
  const web3 = new Web3(provider)
  web3.extend({
    property: 'eth',
    methods: [
      {
        name: 'getRawTransactionByBlockNumberAndIndex',
        call: 'eth_getRawTransactionByBlockNumberAndIndex',
        params: 2,
        inputFormatter: [
          web3.extend.formatters.inputBlockNumberFormatter,
          web3.extend.utils.toHex
        ]
      }
    ]
  })

  return web3
}

// function to store last tx index and block number in a file
// name of file is <ip>-tx-indices.json
function storeTxData(ip, block, txIndex) {
  try {
    const txData = JSON.stringify({
      blockNumber: block,
      lastTxIndex: txIndex
    })
    fs.writeFileSync(`./shadowData/${ip}-tx-indices.json`, txData, 'utf-8')
  } catch (error) {
    console.error(
      `📍 Error occurred while writing last tx index and block number to file: ${error}`
    )
    process.exit(1)
  }
}

// function to fetch last tx index and block number from a file
// name of file is <user@dns>-tx-indices.json
function fetchTxData(ip) {
  try {
    const txData = fs.readFileSync(
      `./shadowData/${ip}-tx-indices.json`,
      'utf-8'
    )
    return JSON.parse(txData)
  } catch (error) {
    console.error(
      `📍 Error occurred while fetching last tx index and block number from file: ${error}`
    )
    process.exit(1)
  }
}

// function to start relayTxn() on all nodes
export async function relay() {
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const doc = await loadDevnetConfig('remote')
  const borUsers = splitToArray(doc.devnetBorUsers.toString())
  const providerToNodeIp = new Map()
  let ip, provider
  const providers = []

  for (let i = 0; i < doc.devnetBorHosts.length; i++) {
    ip = `${borUsers[i]}@${doc.devnetBorHosts[i]}`
    provider = await initWeb3(`ws://${doc.devnetBorHosts[i]}:8546`)
    providers.push(provider)
    providerToNodeIp.set(provider, ip)
  }

  const polygonProviderUrl =
    process.env.NETWORK === 'mainnet'
      ? 'https://polygon-rpc.com'
      : 'https://rpc-mumbai.maticvigil.com'

  const relayTasks = providers.map(async (p, i) => {
    await relayTxs(p, providerToNodeIp.get(p), polygonProviderUrl, i)
  })

  await Promise.all(relayTasks)
}

// function to relay transactions from bor testnet/mainnet to shadow node
// this function is called on all nodes
// If the file ./<user@dns>-tx-indices.json exists, then it will start replaying from the last tx index and block number
// else it will look for ./blockData.json file, if it exists, then it will start replaying from the block number in the file
// else it will start replaying from block 0
async function relayTxs(p, ip, polygonProviderUrl, index) {
  const polygonProvider = await initWeb3(polygonProviderUrl)
  const shadowProvider = p
  let startBlock, startTxIndex

  if (fs.existsSync(`./shadowData/${ip}-tx-indices.json`)) {
    console.log(`📍 Resuming data from ${ip}-relay-data.json`)
    const txData = fetchTxData(ip)
    startBlock = txData.blockNumber
    startTxIndex = txData.lastTxIndex + 1
  } else if (fs.existsSync('./shadowData/blockData.json')) {
    const blockData = fs.readFileSync('./shadowData/blockData.json', 'utf-8')
    console.log(
      '📍 Resuming data from environment variable process.env.RELAY_START_BLOCK_NUMBER'
    )
    startBlock = JSON.parse(blockData).blockNumber
    startTxIndex = 0
  } else {
    console.log('📍 No data to resume, starting from scratch')
    startBlock = 0
    startTxIndex = 0
  }

  print(`📍 Start block: ${startBlock} Start index: ${startTxIndex}`, index)

  let polygonBlock = startBlock

  while (true) {
    const txCount = await polygonProvider.eth.getBlockTransactionCount(
      polygonBlock
    )

    print(`📍 Block ${polygonBlock} has ${txCount} transactions`, index)

    for (let i = startTxIndex; i < txCount; i++) {
      try {
        const rawTx =
          await polygonProvider.eth.getRawTransactionByBlockNumberAndIndex(
            polygonBlock,
            i
          )
        const res = await shadowProvider.eth.sendSignedTransaction(rawTx)

        if (res.status) {
          print(
            `📍 Tx sent to shadow node is mined in block number: ${res.blockNumber}`,
            index
          )
        }
      } catch (error) {
        if (error.receipt) {
          print(
            `📍 Tx sent to shadow node is reverted in block number: ${error.receipt.blockNumber}`,
            index
          )
        } else {
          print(
            `📍 Error occurred while sending tx to shadow node: ${error}`,
            index
          )
        }
      }
      storeTxData(ip, polygonBlock, i)
    }
    print(
      `📍Replayed all transactions in the block number: ${polygonBlock}`,
      index
    )
    startTxIndex = 0
    polygonBlock++
  }
}
