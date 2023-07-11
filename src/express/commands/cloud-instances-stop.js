// noinspection JSUnresolvedFunction

import { loadDevnetConfig } from '../common/config-utils'
import { timer } from '../common/time-utils'
import { stopServices } from './cleanup'
import constants from '../common/constants'

const shell = require('shelljs')

export async function stopInstances() {
  console.log('📍Stopping instances...')
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)
  await stopServices(doc)

  const cloud = doc.cloud.toString()

  if (cloud === constants.cloud.GCP) {
    const project = doc.instancesIds[0].split('/')[1].toString()
    const zone = doc.instancesIds[0].split('/')[3].toString()
    const instances = doc.instancesIds.map(x => x.split('/').at(-1)).toString().replace(/,/g, ' ')
    shell.exec(`gcloud compute instances stop ${instances} --zone ${zone} --project ${project}`)
  } else if (cloud === constants.cloud.AWS) {
    const instances = doc.instancesIds.toString().replace(/,/g, ' ')
    const region = doc.devnetRegion.toString()
    shell.exec(`aws ec2 stop-instances --region ${region} --instance-ids ${instances}`)
  } else {
    console.log(`❌ Unsupported cloud provider ${cloud}`)
    process.exit(1);
  }

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
