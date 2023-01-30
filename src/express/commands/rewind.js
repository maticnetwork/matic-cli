import { loadDevnetConfig, splitToArray } from '../common/config-utils'
const {
  runSshCommand,
  runSshCommandWithReturn,
  maxRetries
} = require('../common/remote-worker')

export async function rewind(num) {
  //   num = number of blocks to rewind
  if (num > 128) {
    console.log(
      '📍number of blocks to rewind should should be less than equal to 128, setting to 128'
    )
    num = 128
  }

  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)

  const borUsers = splitToArray(doc.devnetBorUsers.toString())
  const borHosts = splitToArray(doc.devnetBorHosts.toString())

  if (doc.devnetBorHosts.length > 0) {
    console.log('📍Monitoring the first node', doc.devnetBorHosts[0])
  } else {
    console.log('📍No nodes to monitor, please check your configs! Exiting...')
    process.exit(1)
  }

  const ip = `${borUsers[0]}@${borHosts[0]}`

  const getBlockNumberCommand =
    '/home/ubuntu/go/bin/bor attach ~/.bor/data/bor.ipc --exec "eth.blockNumber"'

  const intitalBlockNumber = await runSshCommandWithReturn(
    ip,
    getBlockNumberCommand,
    maxRetries
  )
  console.log(
    `⏪ rewinding chain by ${num} blocks, \n⛓ current block number: ${intitalBlockNumber}`
  )

  const rewindCommand = `/home/ubuntu/go/bin/bor attach ~/.bor/data/bor.ipc --exec "debug.setHead(web3.toHex(${intitalBlockNumber} - ${num}))"`
  await runSshCommand(ip, rewindCommand, maxRetries)

  const restartCommand = 'sudo service bor restart'
  await runSshCommand(ip, restartCommand, maxRetries)

  const rewindedBlockNumber = await runSshCommandWithReturn(
    ip,
    getBlockNumberCommand,
    maxRetries
  )
  console.log(
    `⏪ rewinded chain by ${
      intitalBlockNumber - rewindedBlockNumber
    } blocks, \n⛓ current block number ${rewindedBlockNumber}`
  )

  console.log(
    'NOTE: minor difference in block number is expected due to small block time'
  )

  console.log('📍Done! Exiting...')
}
