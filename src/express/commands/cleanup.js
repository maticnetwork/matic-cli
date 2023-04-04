import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import { maxRetries, runSshCommand } from '../common/remote-worker'
import { timer } from '../common/time-utils'

export async function cleanup() {
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const doc = await loadDevnetConfig('remote')
  await stopServices(doc)
  await cleanupServices(doc)
  await startServices(doc)
  await deployBorContractsAndStateSync(doc)
}

export async function stopServices(doc) {
  const borUsers = splitToArray(doc.devnetBorUsers.toString())
  const nodeIps = []
  const isHostMap = new Map()
  let user, ip

  for (let i = 0; i < doc.devnetBorHosts.length; i++) {
    i === 0 ? (user = `${doc.ethHostUser}`) : (user = `${borUsers[i]}`)
    ip = `${user}@${doc.devnetBorHosts[i]}`
    nodeIps.push(ip)

    i === 0 ? isHostMap.set(ip, true) : isHostMap.set(ip, false)
  }

  const stopServiceTasks = nodeIps.map(async (ip) => {
    if (isHostMap.get(ip)) {
      console.log('📍Stopping ganache on machine ' + ip + ' ...')
      const command =
        'sudo systemctl stop ganache.service || echo "ganache not running on current machine..."'
      await runSshCommand(ip, command, maxRetries)
    }

    console.log('📍Stopping bor on machine ' + ip + ' ...')
    let command = 'sudo systemctl stop bor.service'
    await runSshCommand(ip, command, maxRetries)

    console.log('📍Stopping heimdall on machine ' + ip + '...')
    command = 'sudo systemctl stop heimdalld.service'
    await runSshCommand(ip, command, maxRetries)
  })

  await Promise.all(stopServiceTasks)
}

async function cleanupServices(doc) {
  const borUsers = splitToArray(doc.devnetBorUsers.toString())
  const nodeIps = []
  const isHostMap = new Map()
  let user, ip

  for (let i = 0; i < doc.devnetBorHosts.length; i++) {
    i === 0 ? (user = `${doc.ethHostUser}`) : (user = `${borUsers[i]}`)
    ip = `${user}@${doc.devnetBorHosts[i]}`
    nodeIps.push(ip)

    i === 0 ? isHostMap.set(ip, true) : isHostMap.set(ip, false)
  }

  const cleanupServicesTasks = nodeIps.map(async (ip) => {
    if (isHostMap.get(ip)) {
      console.log('📍Cleaning up ganache on machine ' + ip + ' ...')
      const command =
        'rm -rf ~/data/ganache-db && rm -rf ~/matic-cli/devnet/data/ganache-db'
      await runSshCommand(ip, command, maxRetries)
    }

    console.log('📍Cleaning up heimdall on machine ' + ip + ' ...')
    let command = 'heimdalld unsafe-reset-all'
    await runSshCommand(ip, command, maxRetries)

    console.log('📍Purging queue for heimdall bridge on machine ' + ip + ' ...')
    command = 'heimdalld heimdall-bridge --home /var/lib/heimdall purge-queue'
    await runSshCommand(ip, command, maxRetries)

    console.log('📍Resetting heimdall bridge on machine ' + ip + ' ...')
    command =
      'heimdalld heimdall-bridge --home /var/lib/heimdall unsafe-reset-all'
    await runSshCommand(ip, command, maxRetries)

    console.log('📍Cleaning up bridge storage on machine ' + ip + ' ...')
    command = 'rm -rf var/lib/heimdall/bridge'
    await runSshCommand(ip, command, maxRetries)

    console.log('📍Cleaning up bor on machine ' + ip + ' ...')
    command = 'rm -rf ~/.bor/data'
    await runSshCommand(ip, command, maxRetries)
  })

  await Promise.all(cleanupServicesTasks)
}

async function startServices(doc) {
  const borUsers = splitToArray(doc.devnetBorUsers.toString())
  const nodeIps = []
  const isHostMap = new Map()
  let user, ip

  for (let i = 0; i < doc.devnetBorHosts.length; i++) {
    i === 0 ? (user = `${doc.ethHostUser}`) : (user = `${borUsers[i]}`)
    ip = `${user}@${doc.devnetBorHosts[i]}`
    nodeIps.push(ip)

    i === 0 ? isHostMap.set(ip, true) : isHostMap.set(ip, false)
  }

  const startServicesTasks = nodeIps.map(async (ip) => {
    if (isHostMap.get(ip)) {
      console.log('📍Running ganache in machine ' + ip + ' ...')
      let command = 'sudo systemctl start ganache.service'
      await runSshCommand(ip, command, maxRetries)

      console.log('📍Deploying main net contracts on machine ' + ip + ' ...')
      command = 'cd ~/matic-cli/devnet && bash ganache-deployment.sh'
      await runSshCommand(ip, command, maxRetries)

      console.log('📍Setting up validators on machine ' + ip + ' ...')
      command = 'cd ~/matic-cli/devnet && bash ganache-stake.sh'
      await runSshCommand(ip, command, maxRetries)
    }

    console.log('📍Setting up heimdall on machine ' + ip + ' ...')
    let command = 'bash ~/node/heimdalld-setup.sh'
    await runSshCommand(ip, command, maxRetries)

    console.log('📍Starting heimdall on machine ' + ip + ' ...')
    command = 'sudo systemctl start heimdalld.service'
    await runSshCommand(ip, command, maxRetries)

    console.log('📍Setting bor on machine ' + ip + ' ...')
    command = 'bash ~/node/bor-setup.sh'
    await runSshCommand(ip, command, maxRetries)

    console.log('📍Starting bor on machine ' + ip + ' ...')
    command = 'sudo systemctl start bor.service'
    await runSshCommand(ip, command, maxRetries)
  })

  await Promise.all(startServicesTasks)
}

async function deployBorContractsAndStateSync(doc) {
  const user = `${doc.ethHostUser}`
  const ip = `${user}@${doc.devnetBorHosts[0]}`

  console.log('📍Deploying contracts for bor on machine ' + ip + ' ...')
  await timer(60000)
  let command = 'cd ~/matic-cli/devnet && bash ganache-deployment-bor.sh'
  await runSshCommand(ip, command, maxRetries)

  console.log('📍Deploying state-sync contracts on machine ' + ip + ' ...')
  await timer(60000)
  command = 'cd ~/matic-cli/devnet && bash ganache-deployment-sync.sh'
  await runSshCommand(ip, command, maxRetries)
}
