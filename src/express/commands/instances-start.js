// noinspection JSUnresolvedFunction

import { loadDevnetConfig } from '../common/config-utils'
import { restartAll } from './restart'
import { maxRetries, runSshCommand } from '../common/remote-worker'
import { timer } from '../common/time-utils'

const shell = require('shelljs')

async function startGanache(doc) {
  const ip = `${doc.ethHostUser}@${doc.devnetBorHosts[0]}`
  console.log('📍Running ganache in machine ' + ip + ' ...')
  const command = 'sudo systemctl start ganache.service'
  await runSshCommand(ip, command, maxRetries)
}

export async function startInstances() {
  console.log('📍Starting instances...')
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'
  const doc = await loadDevnetConfig(devnetType)
  const instances = doc.instancesIds.toString().replace(/,/g, ' ')

  shell.exec(`aws ec2 start-instances --instance-ids ${instances}`)
  if (shell.error() !== null) {
    console.log(
      `📍Starting instances ${doc.instancesIds.toString()} didn't work. Please check AWS manually`
    )
  } else {
    console.log(`📍Instances ${doc.instancesIds.toString()} are starting...`)
  }

  if (devnetType === 'remote') {
    console.log('📍Waiting 30s before restarting all services...')
    await timer(30000)
    await startGanache(doc)
    await restartAll(true)
  } else {
    console.log('📍Waiting 20s to ensure instances are started...')
    await timer(20000)
    console.log(
      '📍You can now ssh into the machine and restart the dockerized services...'
    )
  }
}
