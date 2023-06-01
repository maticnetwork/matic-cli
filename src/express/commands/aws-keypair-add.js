import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import { maxRetries, runSshCommand } from '../common/remote-worker'

const shell = require('shelljs')
export async function awsKeypairAdd() {
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'
  const doc = await loadDevnetConfig(devnetType)

  const time = new Date().getTime()
  const keyName = `temp-key-${time}`
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
    `🚨 Do not forget to destroy the key when no longer needed, using the command "../../bin/express-cli --aws-key-des ${keyName}"`
  )
}
