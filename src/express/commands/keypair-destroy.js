import { loadDevnetConfig, splitToArray } from '../common/config-utils.js'
import { maxRetries, runSshCommand } from '../common/remote-worker.js'
import { getGcpInstancesInfo } from '../common/gcp-utils.js'
import { constants } from '../common/constants.js'
import shell from 'shelljs'
import dotenv from 'dotenv'

export async function keypairDestroy(keyName) {
  if (keyName === true || keyName === null || keyName === undefined) {
    console.log(
      '📍 Invalid keyName specified! Please use a valid keyName for this instance'
    )
    process.exit(1)
  }
  dotenv.config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'
  const doc = await loadDevnetConfig(devnetType)

  const cloud = doc.cloud.toString()

  if (cloud === constants.cloud.AWS) {
    console.log(`📍 Getting pubKey for ${keyName} ...`)
    const output = shell.exec(
      `aws ec2 describe-key-pairs --key-names ${keyName} --include-public-key --output json`
    )
    if (shell.error() !== null) {
      console.log(`📍 Failed to get pubKey from ${keyName}`)
      process.exit(1)
    }
    const pubKey = JSON.parse(output).KeyPairs[0].PublicKey.toString()

    const totalHosts = []
    const totalUsers = []
    const nodeIps = []
    if (doc.devnetBorHosts) {
      totalHosts.push(...splitToArray(doc.devnetBorHosts.toString()))
    }
    if (doc.devnetErigonHosts) {
      totalHosts.push(...splitToArray(doc.devnetErigonHosts.toString()))
    }

    if (doc.devnetBorUsers) {
      totalUsers.push(...splitToArray(doc.devnetBorUsers.toString()))
    }
    if (doc.devnetErigonUsers) {
      totalUsers.push(...splitToArray(doc.devnetErigonUsers.toString()))
    }
    let ip

    for (let i = 0; i < totalHosts.length; i++) {
      ip = `${totalUsers[i]}@${totalHosts[i]}`
      nodeIps.push(ip)
    }

    const removeKeyTasks = nodeIps.map(async (ip) => {
      console.log(`📍 Removing ssh pubKey for ${keyName} from host ${ip} ...`)
      const command = `sed -i 's,${pubKey}, ,' ~/.ssh/authorized_keys`
      await runSshCommand(ip, command, maxRetries)
    })

    await Promise.all(removeKeyTasks)

    console.log(`📍 Destroying aws remote key-pair for ${keyName} ...`)
    shell.exec(`aws ec2 delete-key-pair --key-name ${keyName}`)
    if (shell.error() !== null) {
      console.log('📍Failed to destroy aws key-pair remotely')
      process.exit(1)
    }

    console.log(`📍 Removing key-pair for ${keyName} locally ...`)
    shell.exec(`rm ./${keyName}.pem`)
    if (shell.error() !== null) {
      console.log(`📍Failed to delete ${keyName}.pem locally`)
    }

    console.log(`📍 Key-pair ${keyName} destroyed successfully!`)
  } else if (cloud === constants.cloud.GCP) {
    const instances = getGcpInstancesInfo(doc.instancesIds)
    await Promise.all(
      instances.names.split(' ').map(async (instance) => {
        console.log(`📍 Getting pubKey for ${keyName} ...`)
        const existingPubKeys = shell.exec(
          `gcloud compute instances describe ${instance} --project=${instances.project} --zone=${instances.zone} --format='value(metadata.ssh-keys)'`
        )
        const existingSshKeys = existingPubKeys.split('\n')
        const filteredSshKeys = existingSshKeys.filter(
          (line) => !line.trim().endsWith(keyName)
        )

        if (existingPubKeys.length === filteredSshKeys.length) {
          console.log(`📍 Failed to get pubKey from ${keyName}`)
          process.exit(1)
        }

        const updatedSshKeys = filteredSshKeys.join('\n')
        // This command retrieves the SSH keys from Google Cloud (gcloud). Please note that the output may contain a lot of logs.
        shell.exec(
          `gcloud compute instances add-metadata ${instance} --metadata ssh-keys='${updatedSshKeys}' --project=${instances.project} --zone=${instances.zone}`
        )
      })
    )

    console.log(`📍 Removing key-pair for ${keyName} locally ...`)
    shell.exec(`rm ./${keyName}.pem`)
    if (shell.error() !== null) {
      console.log(`📍Failed to delete ${keyName}.pem locally`)
    }
    shell.exec(`rm ./${keyName}.pem.pub`)
    if (shell.error() !== null) {
      console.log(`📍Failed to delete ${keyName}.pem.pub locally`)
    }

    console.log(`📍 Key-pair ${keyName} destroyed successfully!`)
  } else {
    console.log(`❌ Unsupported cloud provider ${cloud}`)
    process.exit(1)
  }
}
