import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import Web3 from 'web3'
const {
  runSshCommand,
  maxRetries
} = require('../common/remote-worker')
const web3 = new Web3()

// return hex from decimal
export function decToHex(dec) {
  return web3.utils.toHex(dec)
}

export async function rewind(num) {
  //   num = number of blocks to rewind
  if (num > 128) {
    console.log(
      '📍number of blocks to rewind should should be less than 128, set to 127'
    )
    num = 128
  }
  console.log('📍Command --chaos [numberOfBlocks]', num)

  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)

  const borUsers = splitToArray(doc['devnetBorUsers'].toString())
  const borHosts = splitToArray(doc['devnetBorHosts'].toString())

  if (doc['devnetBorHosts'].length > 0) {
    console.log('📍Monitoring the first node', doc['devnetBorHosts'][0])
  } else {
    console.log('📍No nodes to monitor, please check your configs! Exiting...')
    process.exit(1)
  }

  const ip = `${borUsers[0]}@${borHosts[0]}`

  const getBlockNumberCommand = `/home/ubuntu/go/bin/bor attach ~/.bor/data/bor.ipc --exec "eth.blockNumber"`
  console.log(`📍rewinding chain by ${num} blocks, \ncurrent block number:`)
  await runSshCommand(ip, getBlockNumberCommand, maxRetries)

  const rewindCommand = `/home/ubuntu/go/bin/bor attach ~/.bor/data/bor.ipc --exec "debug.setHead(web3.toHex(eth.blockNumber - ${num}))"`
  await runSshCommand(ip, rewindCommand, maxRetries)

  const restartCommand = `sudo service bor restart`  
  await runSshCommand(ip, restartCommand, maxRetries)

  console.log(`📍rewinded chain by ${num} blocks, \ncurrent block number`)
  await runSshCommand(ip, getBlockNumberCommand, maxRetries)
}
