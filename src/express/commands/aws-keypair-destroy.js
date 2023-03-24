import {
  loadDevnetConfig,
  splitAndGetHostIp,
  splitToArray
} from '../common/config-utils'
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

  console.log(`📍 Getting pubKey for ${keyName} ...`)
  const output = shell.exec(
    `aws ec2 describe-key-pairs --key-names ${keyName} --include-public-key --output json`
  )
  if (shell.error() !== null) {
    console.log(`📍 Failed to get pubKey from ${keyName}`)
    process.exit(1)
  }
  const pubKey = JSON.parse(output).KeyPairs[0].PublicKey.toString()

  const ipsArray = splitToArray(doc.devnetBorHosts.toString())
  const borUsers = splitToArray(doc.devnetBorUsers.toString())
  let user, ip
  const nodeIps = []

  for (let i = 0; i < ipsArray.length; i++) {
    i === 0 ? (user = `${doc.ethHostUser}`) : (user = `${borUsers[i]}`)
    ip = `${user}@${ipsArray[i]}`
    nodeIps.push(ip)
  }

  const removeKeyTasks = nodeIps.map(async (ip) => {
    user = splitAndGetHostIp(ip)
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
