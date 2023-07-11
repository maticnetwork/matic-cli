import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import { maxRetries, runSshCommand } from '../common/remote-worker'
import constants from '../common/constants'

const shell = require('shelljs')
const fs = require('fs')
export async function keypairAdd() {
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'
  const doc = await loadDevnetConfig(devnetType)

  const time = new Date().getTime()
  const keyName = `temp-key-${time}`
  const cloud = doc.cloud.toString()

  if (cloud === constants.cloud.AWS) {
    console.log('📍 Generating aws key-pair...')
    shell.exec(
      `aws ec2 create-key-pair --key-name ${keyName} --key-type rsa --key-format pem --query "KeyMaterial" --output text > ${keyName}.pem`
    )

    if (shell.error() !== null) {
      console.log('📍 Creation of aws key-pair failed')
      process.exit(1)
    } else {
      console.log(`📍 Creation of aws key-pair ${keyName} successful`)
    }
    console.log(`📍 Assigning proper permission to ${keyName} ...`)
    shell.exec(`chmod 700 ${keyName}.pem`)
    if (shell.error() !== null) {
      console.log(`📍 Granting permissions to ${keyName} failed`)
      process.exit(1)
    }
    const output = shell.exec(
      `aws ec2 describe-key-pairs --key-names ${keyName} --include-public-key --output json`
    )
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

    const addKeyTasks = nodeIps.map(async (ip) => {
      console.log(`📍 Adding ssh pubKey for ${keyName} to host ` + ip)
      const command = `echo ${pubKey} >> ~/.ssh/authorized_keys`
      await runSshCommand(ip, command, maxRetries)
    })

    await Promise.all(addKeyTasks)
    console.log(`📍 Successfully added ${keyName} to all machines of the devnet`)
    console.log(
      `🔑 You can now share ${keyName}.pem with other devs - on a secure channel - to let them access the devnet`
    )
    console.log(
      `🚨 Do not forget to destroy the key when no longer needed, using the command "../../bin/express-cli --ssh-key-des ${keyName}"`
    )
  } else if (cloud == constants.cloud.GCP) {
    const user = doc.ethHostUser.toString()
    const project = doc.instancesIds[0].split('/')[1].toString()
    const zone = doc.instancesIds[0].split('/')[3].toString()
    const instances = doc.instancesIds.map(x => x.split('/').at(-1)).toString().replace(/,/g, ' ').split(" ")
    const keyFilePath = `${keyName}.pem.pub`

    console.log('📍 Generating gcp key-pair...')
    shell.exec(
      `ssh-keygen -t rsa -q -N '' -C ${keyName} -f ${keyName}.pem`
    )

    await Promise.all(instances.map(async (instance) => {
      // This command retrieves the SSH keys from Google Cloud (gcloud). Please note that the output may contain a lot of logs.
      const existing_keys = shell.exec(
        `gcloud compute instances describe ${instance} --project=${project} --zone=${zone} --format='value(metadata.ssh-keys)'`
      )

      const new_public_key = await new Promise((resolve, reject) => {
        fs.readFile(keyFilePath, 'utf-8', (error, data) => {
          if (error) {
            console.error('Error reading file:', error)
            reject(error)
          } else {
            resolve(data)
          }
        })
      })

      const new_keys = new_public_key + existing_keys

      shell.exec(
        `gcloud compute instances add-metadata ${instance} --metadata ssh-keys="${user}:${new_keys}" --project=${project} --zone=${zone}`
      )
    }))

    console.log(`📍 Successfully added ${keyName} to all machines of the devnet`)
    console.log(
      `🔑 You can now share ${keyName}.pem with other devs - on a secure channel - to let them access the devnet`
    )
    console.log(
      `🚨 Do not forget to destroy the key when no longer needed, using the command "../../bin/express-cli --ssh-key-des ${keyName}"`
    )
  } else {
    console.log(`❌ Unsupported cloud provider ${cloud}`)
    process.exit(1)
  }
}
