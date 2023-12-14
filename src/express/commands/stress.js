// noinspection JSUnresolvedFunction

import { getDevnetId, loadDevnetConfig } from '../common/config-utils.js'

import { runScpCommand, maxRetries } from '../common/remote-worker.js'
import shell from 'shelljs'
import dotenv from 'dotenv'

export async function startStressTest(fund) {
  const doc = await loadDevnetConfig('remote')
  const devnetId = getDevnetId()
  dotenv.config({ path: `${process.cwd()}/.env` })
  let machine0
  if (
    doc.devnetBorHosts.length > 0 &&
    parseInt(process.env.TF_VAR_BOR_VALIDATOR_COUNT) > 0
  ) {
    console.log('📍Monitoring the first node', doc.devnetBorHosts[0])
    machine0 = doc.devnetBorHosts[0]
  } else {
    console.log('📍Monitoring the first node', doc.devnetErigonHosts[0])
    machine0 = doc.devnetErigonHosts[0]
  }

  const src = `${doc.ethHostUser}@${machine0}:~/matic-cli/devnet/devnet/signer-dump.json`
  const dest = './signer-dump.json'
  await runScpCommand(src, dest, maxRetries)

  shell.pushd('../../tests/stress-test')
  shell.exec('go mod tidy')

  shell.exec(`go run main.go ${devnetId}`, {
    env: {
      ...process.env,
      FUND: fund
    }
  })

  shell.popd()
}
