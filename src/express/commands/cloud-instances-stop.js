// noinspection JSUnresolvedFunction

import { loadDevnetConfig } from '../common/config-utils.js'
import { timer } from '../common/time-utils.js'
import { stopServices } from './cleanup.js'
import { getGcpInstancesInfo } from '../common/gcp-utils.js'
import { constants } from '../common/constants.js'
import dotenv from 'dotenv'

import shell from 'shelljs'

export async function stopInstances() {
  console.log('📍Stopping instances...')
  dotenv.config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)
  await stopServices(doc)

  const cloud = doc.cloud.toString()

  if (cloud === constants.cloud.GCP) {
    const instances = getGcpInstancesInfo(doc.instancesIds)
    shell.exec(
      `gcloud compute instances stop ${instances.names} --zone ${instances.zone} --project ${instances.project}`
    )
  } else if (cloud === constants.cloud.AWS) {
    const instances = doc.instancesIds.toString().replace(/,/g, ' ')
    const region = doc.devnetRegion.toString()
    shell.exec(
      `aws ec2 stop-instances --region ${region} --instance-ids ${instances}`
    )
  } else {
    console.log(`❌ Unsupported cloud provider ${cloud}`)
    process.exit(1)
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
