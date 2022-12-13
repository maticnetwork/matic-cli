// noinspection JSUnresolvedFunction

import { getDevnetId, loadDevnetConfig } from '../common/config-utils'

const { runScpCommand, maxRetries } = require('../common/remote-worker')
const shell = require('shelljs')

export async function startStressTest (fund) {
  const doc = await loadDevnetConfig('remote')
  const devnetId = getDevnetId()
  require('dotenv').config({ path: `${process.cwd()}/.env` })

  if (doc.devnetBorHosts.length > 1) {
    console.log('📍Monitoring the first node', doc.devnetBorHosts[0])
  }
  const machine0 = doc.devnetBorHosts[0]

  const src = `${doc.ethHostUser}@${machine0}:~/matic-cli/devnet/devnet/signer-dump.json`
  const dest = './signer-dump.json'
  await runScpCommand(src, dest, maxRetries)

  shell.pushd('../../tests/stress-test')
  shell.exec('go mod tidy')

  shell.exec(`go run main.go ${devnetId}`, {
    env: {
      ...process.env, FUND: fund
    }
  })

  shell.popd()
}
