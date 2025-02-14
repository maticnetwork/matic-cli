// noinspection JSUnresolvedVariable

import { loadDevnetConfig } from '../common/config-utils.js'

import {
  runScpCommand,
  runSshCommand,
  maxRetries
} from '../common/remote-worker.js'

import dotenv from 'dotenv'
import fs from 'fs-extra'

export async function sendStateSyncTx() {
  dotenv.config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)
  let machine0
  if (doc.numOfBorValidators > 0) {
    machine0 = doc.devnetBorHosts[0]
    console.log('📍Monitoring the first node', doc.devnetBorHosts[0])
  } else if (devnetType === 'remote') {
    machine0 = doc.devnetErigonHosts[0]
    console.log('📍Monitoring the first node', doc.devnetErigonHosts[0])
  } else {
    console.log('📍No nodes to monitor, please check your configs! Exiting...')
    process.exit(1)
  }

  const src = `${doc.ethHostUser}@${machine0}:~/matic-cli/devnet/code/contracts/contractAddresses.json`
  const dest = './contractAddresses.json'
  await runScpCommand(src, dest, maxRetries)

  const contractAddresses = JSON.parse(
    fs.readFileSync(`${process.cwd()}/contractAddresses.json`, 'utf8')
  )

  const MaticToken = contractAddresses.root.tokens.MaticToken

  console.log('📍Sending StateSync Tx')
  const command = `cd ~/matic-cli/devnet/code/contracts && npm run truffle exec scripts/deposit.js -- --network development ${MaticToken} 100000000000000000000`
  await runSshCommand(`${doc.ethHostUser}@${machine0}`, command, maxRetries)

  console.log(
    '📍StateSync Tx Sent, check with "../../bin/express-cli.js --monitor"'
  )
}
