import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import { maxRetries, runSshCommand } from '../common/remote-worker'

const shell = require('shelljs')
export async function awsKeypairDestroy(keyName) {
  if (keyName === true || keyName === null || keyName === undefined) {
    console.log(
      '📍 Invalid keyName specified! Please use a valid keyName for this instance'
    )
    process.exit(1)
  }
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'
  const doc = await loadDevnetConfig(devnetType)

  const cloud = doc.cloud.toString()
  
  if (cloud == 'gcp'){
    console.log('📍 Not supported for gcp at the moment')
    return
  }

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
}
