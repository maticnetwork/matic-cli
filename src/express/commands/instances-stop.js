// noinspection JSUnresolvedFunction

import { loadDevnetConfig } from '../common/config-utils'
import { timer } from '../common/time-utils'

const shell = require('shelljs')

export async function stopInstances() {
  console.log('📍Stopping instances...')
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'
  const doc = await loadDevnetConfig(devnetType)
  const instances = doc.instancesIds.toString().replace(/,/g, ' ')

  shell.exec(`aws ec2 stop-instances --instance-ids ${instances}`)
  if (shell.error() !== null) {
    console.log(
      `📍Stopping instances ${doc.instancesIds.toString()} didn't work. Please check AWS manually`
    )
  } else {
    console.log('📍Waiting 20s to ensure instances are stopped...')
    await timer(20000)
    console.log(`📍Instances ${doc.instancesIds.toString()} are stopping...`)
  }
}
