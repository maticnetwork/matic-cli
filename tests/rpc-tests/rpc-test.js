import fs from 'fs'
import path from 'path'
import {
  maxRetries,
  runScpCommand,
  runSshCommand,
  runSshCommandWithReturn
} from '../../src/express/common/remote-worker'
import assert from 'assert'
import { loadDevnetConfig } from '../../src/express/common/config-utils'
import HDWalletProvider from '@truffle/hdwallet-provider'
import { timer } from '../../src/express/common/time-utils'
import { fundAccount } from '../test-utils'
const axios = require('axios/dist/node/axios.cjs')
const Web3 = require('web3')
const ethUtil = require('ethereumjs-util')
const Transaction = require('ethereumjs-tx')
const _ = require('lodash')

require('dotenv').config({ path: `${process.cwd()}/.env` })

const txHashRegex = /^0x[0-9a-f]{64}$/
const signedTxRegex = /^0x[0-9a-f]*$/
const blockHashRegex = /^0x[0-9a-f]{64}$/
const accountRegex = /^0x[0-9a-fA-F]{40}$/
const topicRegex = /^0x[0-9a-fA-F]{64}$/
const logDataRegex = /^0x[0-9a-fA-F]*$/
const blockNumberRegex = /^0x([1-9a-f]+[0-9a-f]*|0)$/
const txIndexRegex = /^0x[0-9a-fA-F]*$/
const logIndexRegex = /^0x[0-9a-fA-F]*$/
const filterIdRegex = /^0x[0-9a-fA-F]+$/

async function initWeb3(machine) {
  let providerOrUrl = `http://${machine}:8545`
  if (process.env.RPC_URL) {
    providerOrUrl = `${machine}`
  }
  const provider = new HDWalletProvider({
    mnemonic: {
      phrase: process.env.MNEMONIC
    },
    providerOrUrl: providerOrUrl
  })

  return new Web3(provider)
}

async function init() {
  console.log('📍Executing RPC tests')
  let machine, ip
  if (process.env.RPC_URL) {
    machine = process.env.RPC_URL
    const web3 = await initWeb3(machine)
    const sender = web3.eth.accounts.privateKeyToAccount(
      process.env.PRIVATE_KEY
    )
    return [machine, web3, sender.address]
  } else {
    const doc = await loadDevnetConfig('remote')
    machine = doc.devnetBorHosts[0]
    const user = doc.devnetBorUsers[0]
    ip = `${user}@${machine}`
    const borStartScriptLocation = '~/node/bor-start.sh'

    const walletDisableFlagCmd = `grep -q 'disable-bor-wallet=false' ${borStartScriptLocation} && echo 'found' || echo 'not found'`
    const isPresent = await runSshCommandWithReturn(
      ip,
      walletDisableFlagCmd,
      maxRetries
    )

    if (isPresent === 'not found') {
      const addFlagsCmd = `sed -i 's/--allow-insecure-unlock \\\\/&\\n  --disable-bor-wallet=false \\\\/' ${borStartScriptLocation}`
      const restartBorCmd = 'sudo service bor restart'
      const isSyncingCmd =
        '~/go/bin/bor attach ~/.bor/data/bor.ipc --exec "eth.syncing"'

      console.log(
        '📍Updating start script on machine to unlock node account ... '
      )
      await runSshCommand(ip, addFlagsCmd, maxRetries)

      console.log('📍Restarting bor on machine ... ')
      await runSshCommand(ip, restartBorCmd, maxRetries)

      await timer(100000)

      while (true) {
        const isSyncing = await runSshCommandWithReturn(
          ip,
          isSyncingCmd,
          maxRetries
        )
        if (isSyncing === 'false') {
          console.log('📍Node sync completed ... ')
          break
        }
      }
    }
  }
  const web3 = await initWeb3(machine)

  const src = `${ip}:~/.bor/address.txt`
  const dest = './address.txt'
  await runScpCommand(src, dest, maxRetries)

  const addrText = fs.readFileSync('./address.txt', 'utf-8')
  const nodeAccount = addrText.split(/\r?\n/)[0]
  const balance = await web3.eth.getBalance(nodeAccount)

  if (balance <= web3.utils.toWei('0.5', 'ether')) {
    console.log('Node account is running low on funds. Refilling...')
    await web3.eth.accounts.wallet.add(process.env.PRIVATE_KEY)
    const sender = web3.eth.accounts.privateKeyToAccount(
      process.env.PRIVATE_KEY
    )
    const nonce = await web3.eth.getTransactionCount(sender.address)
    await fundAccount(
      web3,
      sender,
      [nodeAccount],
      30000000009,
      30000000000,
      nonce,
      '5000000000000000000'
    )
  }
  console.log('Balance of node account: ', balance)

  return [machine, web3, nodeAccount]
}

function fetchTestFiles(dir) {
  try {
    let testData = []

    fs.readdirSync(dir).forEach((file) => {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)

      if (stat.isDirectory()) {
        testData = testData.concat(fetchTestFiles(filePath))
      } else {
        const data = fs.readFileSync(filePath, 'utf8')
        const jsonData = JSON.parse(data)
        testData.push(jsonData)
      }
    })

    return testData
  } catch (error) {
    console.error('Error occurred while fetching test rpc data: ', error)
  }
}

function isValidTxHash(txHashes) {
  if (Array.isArray(txHashes)) {
    txHashes.forEach((txHash) => {
      if (!txHash.match(txHashRegex)) {
        console.log('❌ Invalid transaction hash: ', txHash)
        return false
      }
    })
    return true
  } else {
    if (!txHashes.match(txHashRegex)) {
      console.log('❌ Invalid transaction hash: ', txHashes)
      return false
    }
    return true
  }
}

function isValidBlockHash(blockHashes) {
  if (Array.isArray(blockHashes)) {
    blockHashes.forEach((blockHash) => {
      if (!blockHash.match(blockHashRegex)) {
        console.log('❌ Invalid block hash: ', blockHashRegex)
        return false
      }
    })
    return true
  } else {
    if (!blockHashes.match(blockHashRegex)) {
      console.log('❌ Invalid block hash: ', blockHashRegex)
      return false
    }
    return true
  }
}

function isValidFilterLog(logs) {
  for (let i = 0; i < logs.length; i++) {
    for (let j = 0; j < logs[i].topics.length; j++) {
      if (!logs[i].topics[j].match(topicRegex)) {
        console.log('❌ Invalid topic: ', logs[i].topics[j])
        return false
      }
    }

    if (!logs[i].address.match(accountRegex)) {
      console.log('❌ Invalid address: ', logs[i].address)
      return false
    }

    if (!logs[i].data.match(logDataRegex)) {
      console.log('❌ Invalid log data: ', logs[i].data)
      return false
    }

    if (!logs[i].blockNumber.match(blockNumberRegex)) {
      console.log('❌ Invalid block number: ', logs[i].blockNumber)
      return false
    }

    if (!logs[i].transactionHash.match(txHashRegex)) {
      console.log('❌ Invalid transaction hash: ', logs[i].transactionHash)
      return false
    }

    if (!logs[i].transactionIndex.match(txIndexRegex)) {
      console.log('❌ Invalid transaction index: ', logs[i].transactionIndex)
      return false
    }

    if (!logs[i].blockHash.match(blockHashRegex)) {
      console.log('❌ Invalid block hash: ', logs[i].blockHash)
      return false
    }

    if (!logs[i].logIndex.match(logIndexRegex)) {
      console.log('❌ Invalid log index: ', logs[i].logIndex)
      return false
    }

    if (logs[i].removed !== true && logs[i].removed !== false) {
      console.log('❌ Invalid removed log field: ', logs[i].removed)
      return false
    }
  }

  return true
}

function isValidSignedMessage(message, signature, address) {
  const msgHash = ethUtil.hashPersonalMessage(Buffer.from(message))
  const { r, s, v } = ethUtil.fromRpcSig(signature)
  const pubKey = ethUtil.ecrecover(msgHash, v, r, s)

  const recoveredAddress = '0x' + ethUtil.pubToAddress(pubKey).toString('hex')
  return recoveredAddress === address && ethUtil.isValidSignature(v, r, s)
}

async function updateSenderTestData(
  sendTestData,
  web3,
  sender,
  nonce,
  axiosInstance
) {
  let response
  // prepare sender address
  for (let i = 0; i < sendTestData.length; i++) {
    if (
      process.env.RPC_URL &&
      (sendTestData[i].req.method === 'eth_sendRawTransaction' ||
        sendTestData[i].req.method === 'eth_sign' ||
        sendTestData[i].req.method === 'eth_signTransaction' ||
        sendTestData[i].req.method === 'eth_sendTransaction')
    ) {
      continue
    }

    if (sendTestData[i].req.method === 'eth_sign') {
      sendTestData[i].req.params[0] = sender
    } else if (
      sendTestData[i].req.method === 'eth_sendTransaction' ||
      sendTestData[i].req.method === 'eth_signTransaction'
    ) {
      sendTestData[i].req.params[0].from = sender
    }

    // raw transaction to be used in eth_sendRawTransaction
    if (sendTestData[i].req.method === 'eth_signTransaction') {
      sendTestData[i].req.params[0].nonce = web3.utils.toHex(nonce)
      response = await axiosInstance.post('/', sendTestData[i].req)
      console.log(`signed tx: ${response.data.result.raw}`)
    }
  }

  for (let i = 0; i < sendTestData.length; i++) {
    if (process.env.RPC_URL) {
      continue
    }
    if (sendTestData[i].req.method === 'eth_sendRawTransaction') {
      sendTestData[i].req.params[0] = response.data.result.raw
      break
    }
  }
}

function sortAccessList(accessList) {
  const sortedAccessList = _.sortBy(accessList, 'address')

  _.forEach(sortedAccessList, (obj) => {
    obj.storageKeys = _.sortBy(obj.storageKeys)
  })

  return sortedAccessList
}

export async function rpcTest() {
  try {
    const [machine, web3, sender] = await init()

    const getCurrentSnapshot = {
      method: 'bor_getSnapshot',
      params: ['latest'],
      id: 1,
      jsonrpc: '2.0'
    }

    // Getter rpc calls
    let axiosInstance
    const getTestData = fetchTestFiles(
      `../../tests/rpc-tests/RPC-testdata/${process.env.RPC_NETWORK}/getters`
    )
    if (process.env.RPC_URL) {
      axiosInstance = axios.create({
        baseURL: `${machine}`
      })
    } else {
      axiosInstance = axios.create({
        baseURL: `http://${machine}:8545`
      })
    }

    let response

    let getterIterattions = process.env.EXECUTION_COUNT_GETTERS
    if (
      getterIterattions <= 0 ||
      getterIterattions === null ||
      getterIterattions === undefined
    ) {
      getterIterattions = 1
    }

    for (let iter = 0; iter < getterIterattions; iter++) {
      console.log('📍Executing getter rpc calls. Iteration: ', iter)
      for (let i = 0; i < getTestData.length; i++) {
        console.log('📍 Executing: ', getTestData[i].req.method)
        response = await axiosInstance.post('/', getTestData[i].req)

        if (getTestData[i].req.method === 'bor_getCurrentProposer') {
          const currentSnapshotResponse = await axiosInstance.post(
            '/',
            getCurrentSnapshot
          )
          // If the validator set changes, the assertion will fail
          response = await axiosInstance.post('/', getTestData[i].req)
          assert.deepStrictEqual(
            currentSnapshotResponse.data.result.validatorSet.proposer.signer,
            response.data.result
          )
          continue
        }

        if (getTestData[i].req.method === 'bor_getCurrentValidators') {
          const currentSnapshotResponse = await axiosInstance.post(
            '/',
            getCurrentSnapshot
          )
          // If the validator set changes, the assertion will fail
          response = await axiosInstance.post('/', getTestData[i].req)
          assert.deepStrictEqual(
            currentSnapshotResponse.data.result.validatorSet.validators,
            response.data.result
          )
          continue
        }

        if (getTestData[i].req.method === 'eth_createAccessList') {
          assert.deepStrictEqual(
            sortAccessList(response.data.result.accessList),
            sortAccessList(getTestData[i].res.result.accessList)
          )
          assert.deepStrictEqual(
            response.data.result.gasUsed,
            getTestData[i].res.result.gasUsed
          )
        } else {
          assert.deepStrictEqual(response.data, getTestData[i].res)
        }
      }
    }

    // Sender rpc calls
    const sendTestData = fetchTestFiles(
      `../../tests/rpc-tests/RPC-testdata/${process.env.RPC_NETWORK}/senders`
    )

    let nonce = await web3.eth.getTransactionCount(sender)

    const getFilterChanges = {
      method: 'eth_getFilterChanges',
      params: [''],
      id: 1,
      jsonrpc: '2.0'
    }
    let filterResponse

    const getFilterLogs = {
      method: 'eth_getFilterLogs',
      params: [''],
      id: 1,
      jsonrpc: '2.0'
    }
    let filterLogsResponse

    let senderrIterattions = process.env.EXECUTION_COUNT_SENDERS
    if (
      senderrIterattions <= 0 ||
      senderrIterattions === null ||
      senderrIterattions === undefined
    ) {
      senderrIterattions = 1
    }

    // Finally, fire 'em
    for (let iter = 0; iter < senderrIterattions; iter++) {
      await updateSenderTestData(
        sendTestData,
        web3,
        sender,
        nonce,
        axiosInstance
      )
      console.log('📍Executing sender rpc calls. Iteration: ', iter)
      for (let i = 0; i < sendTestData.length; i++) {
        if (
          process.env.RPC_URL &&
          (sendTestData[i].req.method === 'eth_sendRawTransaction' ||
            sendTestData[i].req.method === 'eth_sign' ||
            sendTestData[i].req.method === 'eth_signTransaction' ||
            sendTestData[i].req.method === 'eth_sendTransaction')
        ) {
          continue
        }
        console.log('📍 Executing: ', sendTestData[i].req.method)
        response = await axiosInstance.post('/', sendTestData[i].req)
        if (response.data.error !== undefined && response.data.error !== null) {
          console.error(
            `❌ Invalid rpc call for : ${sendTestData[i].req.method} `,
            response.data,
            response.data.error
          )
          process.exit(1)
        }

        if (
          sendTestData[i].req.method === 'eth_pendingTransactions' &&
          response.data.result.length > 0 &&
          !isValidTxHash(response.data.result)
        ) {
          console.error(
            `❌ Invalid transaction hash returned : ${sendTestData[i].req.method} `,
            response.data.result
          )
          process.exit(1)
        }

        if (
          (sendTestData[i].req.method === 'eth_sendRawTransaction' ||
            sendTestData[i].req.method === 'eth_sendTransaction') &&
          !isValidTxHash(response.data.result)
        ) {
          console.error(
            `❌ Invalid transaction hash returned : ${sendTestData[i].req.method} `,
            response.data.result
          )
          process.exit(1)
        }

        if (
          sendTestData[i].req.method === 'eth_sign' &&
          isValidSignedMessage(
            sendTestData[i].req.params[1],
            response.data.result,
            sendTestData[i].req.params[0]
          )
        ) {
          console.error(
            `❌ Invalid signature returned : ${sendTestData[i].req.method} `,
            response.data.result
          )
          process.exit(1)
        }

        if (sendTestData[i].req.method === 'eth_signTransaction') {
          if (!response.data.result.raw.match(signedTxRegex)) {
            console.error(
              `❌ Invalid signed transaction returned : ${sendTestData[i].req.method} `,
              response.data.result.raw
            )
            process.exit(1)
          }

          if (
            response.data.result.tx.type !== '0x0' &&
            response.data.result.tx.type !== '0x1' &&
            response.data.result.tx.type !== '0x2'
          ) {
            console.error(
              `❌ Invalid transaction type returned : ${sendTestData[i].req.method} `,
              response.data.result.tx.type
            )
            process.exit(1)
          }

          if (
            response.data.result.tx.nonce !==
            sendTestData[i].req.params[0].nonce
          ) {
            console.error(
              `❌ Invalid nonce returned : ${sendTestData[i].req.method} `,
              response.data.result.tx.nonce
            )
            process.exit(1)
          }

          if (
            response.data.result.tx.gas !== sendTestData[i].req.params[0].gas
          ) {
            console.error(
              `❌ Invalid gas returned : ${sendTestData[i].req.method} `,
              response.data.result.tx.gas
            )
            process.exit(1)
          }

          if (
            response.data.result.tx.value !==
            sendTestData[i].req.params[0].value
          ) {
            console.error(
              `❌ Invalid value returned : ${sendTestData[i].req.method} `,
              response.data.result.tx.value
            )
            process.exit(1)
          }

          if (
            response.data.result.tx.to.trim().toLowerCase() !==
            sendTestData[i].req.params[0].to.trim().toLowerCase()
          ) {
            console.error(
              `❌ Invalid to address returned : ${sendTestData[i].req.method} `,
              response.data.result.tx.to,
              sendTestData[i].req.params[0].to,
              response.data.result.tx.to === sendTestData[i].req.params[0].to
            )
            process.exit(1)
          }

          if (
            sendTestData[i].req.params[0].gasPrice !== null &&
            sendTestData[i].req.params[0].gasPrice !== undefined &&
            response.data.result.tx.gasPrice !==
              sendTestData[i].req.params[0].gasPrice
          ) {
            console.error(
              `❌ Invalid gasPrice returned : ${sendTestData[i].req.method} `,
              response.data.result.tx.gasPrice
            )
            process.exit(1)
          }

          if (
            sendTestData[i].req.params[0].maxPriorityFeePerGas !== null &&
            sendTestData[i].req.params[0].maxPriorityFeePerGas !== undefined &&
            response.data.result.tx.maxPriorityFeePerGas !==
              sendTestData[i].req.params[0].maxPriorityFeePerGas
          ) {
            console.error(
              `❌ Invalid maxPriorityFeePerGas returned : ${sendTestData[i].req.method} `,
              response.data.result.tx.maxPriorityFeePerGas
            )
            process.exit(1)
          }

          if (
            sendTestData[i].req.params[0].maxFeePerGas !== null &&
            sendTestData[i].req.params[0].maxFeePerGas !== undefined &&
            response.data.result.tx.maxFeePerGas !==
              sendTestData[i].req.params[0].maxFeePerGas
          ) {
            console.error(
              `❌ Invalid maxFeePerGas returned : ${sendTestData[i].req.method} `,
              response.data.result.tx.maxFeePerGas
            )
            process.exit(1)
          }

          if (
            sendTestData[i].req.params[0].input !== null &&
            sendTestData[i].req.params[0].input !== undefined &&
            response.data.result.tx.input !== '0x'
          ) {
            console.error(
              `❌ Invalid input returned : ${sendTestData[i].req.method} `,
              response.data.result.tx.input
            )
            process.exit(1)
          }

          if (!response.data.result.tx.hash.match(txHashRegex)) {
            console.error(
              `❌ Invalid transaction hash returned : ${sendTestData[i].req.method} `,
              response.data.result.tx.hash
            )
            process.exit(1)
          }

          const tx = new Transaction(response.data.result.raw)
          const v = '0x' + tx.v.toString('hex').slice(1)

          let r = tx.r.toString('hex')
          if (r.charAt(0) === '0') {
            r = '0x' + r.slice(1)
          } else {
            r = '0x' + r
          }

          let s = tx.s.toString('hex')
          if (s.charAt(0) === '0') {
            s = '0x' + s.slice(1)
          } else {
            s = '0x' + s
          }

          if (r !== response.data.result.tx.r) {
            console.error(
              `❌ Invalid r field returned: ${sendTestData[i].req.method} `,
              response.data.result.tx.r,
              r
            )
            process.exit(1)
          }

          if (s !== response.data.result.tx.s) {
            console.error(
              `❌ Invalid s field returned: ${sendTestData[i].req.method} `,
              response.data.result.tx.s,
              s
            )
            process.exit(1)
          }

          if (v !== response.data.result.tx.v) {
            console.error(
              `❌ Invalid v field returned: ${sendTestData[i].req.method} `,
              response.data.result.tx.v,
              v
            )
            process.exit(1)
          }
        }
        console.log(
          `${JSON.stringify(sendTestData[i].req.method)}: `,
          response.data
        )

        if (sendTestData[i].req.method === 'eth_newFilter') {
          if (!response.data.result.match(filterIdRegex)) {
            console.error(
              `❌ Invalid filter ID returned : ${sendTestData[i].req.method} `,
              response.data.result
            )
            process.exit(1)
          }
          getFilterLogs.params[0] = response.data.result
          filterLogsResponse = await axiosInstance.post('/', getFilterLogs)

          if (
            filterLogsResponse.data.error !== undefined &&
            filterLogsResponse.data.error !== null
          ) {
            console.error(
              `❌ Error while fetching the changes for the filter : ${sendTestData[i].req.method} `,
              filterLogsResponse.data,
              filterLogsResponse.data.error
            )
            process.exit(1)
          }

          if (
            filterLogsResponse.data.result.length > 0 &&
            !isValidFilterLog(filterLogsResponse.data.result)
          ) {
            console.error(
              `❌ Invalid log returned : ${sendTestData[i].req.method} `,
              filterLogsResponse.data
            )
            process.exit(1)
          }
          console.log(
            'eth_getFilterLogs: ',
            JSON.stringify(filterLogsResponse.data)
          )
        }

        if (
          sendTestData[i].req.method === 'eth_newBlockFilter' ||
          sendTestData[i].req.method === 'eth_newPendingTransactionFilter'
        ) {
          if (!response.data.result.match(filterIdRegex)) {
            console.error(
              `❌ Invalid filter ID returned : ${sendTestData[i].req.method} `,
              response.data.result
            )
            process.exit(1)
          }
          getFilterChanges.params[0] = response.data.result
          filterResponse = await axiosInstance.post('/', getFilterChanges)

          if (
            filterResponse.data.error !== undefined &&
            filterResponse.data.error !== null
          ) {
            console.error(
              `❌ Error while fetching the changes for the filter : ${sendTestData[i].req.method} `,
              filterResponse.data,
              filterResponse.data.error
            )
            process.exit(1)
          }

          if (
            sendTestData[i].req.method === 'eth_newBlockFilter' &&
            filterResponse.data.result.length > 0 &&
            !isValidBlockHash(filterResponse.data.result)
          ) {
            console.error(
              `❌ Invalid block hash returned : ${sendTestData[i].req.method} `,
              filterResponse.data.result
            )
            process.exit(1)
          }

          if (
            sendTestData[i].req.method === 'eth_newPendingTransactionFilter' &&
            filterResponse.data.result.length > 0 &&
            !isValidTxHash(filterResponse.data.result)
          ) {
            console.error(
              `❌ Invalid transaction hash returned : ${sendTestData[i].req.method} `,
              filterResponse.data.result
            )
            process.exit(1)
          }
          console.log(
            'eth_getFilterChanges: ',
            JSON.stringify(filterResponse.data)
          )
        }
      }
      nonce += 2
    }

    console.log('📍All RPC tests passed!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error occurred while running rpc tests: ', error)
    process.exit(1)
  }
}
