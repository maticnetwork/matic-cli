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

  // let user, ip
  let ip
  const isHostMap = new Map()
  const hostToIndexMap = new Map()

  for (let i = 0; i < totalHosts.length; i++) {
    /* eslint-disable */
    ip = `${totalUsers[i]}@${totalHosts[i]}`
    hostToIndexMap.set(ip, i)
    nodeIps.push(ip)
    i === 0 && parseInt(process.env.TF_VAR_BOR_VALIDATOR_COUNT) > 0
      ? isHostMap.set(ip, true)
      : i === doc.devnetBorHosts.length
      ? isHostMap.set(ip, true)
      : isHostMap.set(ip, false)
    /* eslint-disable */
  }

  let command
  const stopServiceTasks = nodeIps.map(async (ip) => {
    if (isHostMap.get(ip)) {
      console.log('📍Stopping ganache on machine ' + ip + ' ...')
      command =
        'sudo systemctl stop ganache.service || echo "ganache not running on current machine..."'
      await runSshCommand(ip, command, maxRetries)
    }

    if (hostToIndexMap.get(ip) < doc.devnetBorHosts.length) {
      console.log('📍Stopping bor on machine ' + ip + ' ...')
      command = 'sudo systemctl stop bor.service'
      await runSshCommand(ip, command, maxRetries)
    } else {
      console.log('📍Stopping erigon on machine ' + ip + ' ...')
      command = 'sudo systemctl stop erigon.service'
      await runSshCommand(ip, command, maxRetries)
    }
    console.log('📍Stopping heimdall on machine ' + ip + '...')
    command = 'sudo systemctl stop heimdalld.service'
    await runSshCommand(ip, command, maxRetries)
  })

  await Promise.all(stopServiceTasks)
}

async function cleanupServices(doc) {
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
  const isHostMap = new Map()
  const hostToIndexMap = new Map()

  for (let i = 0; i < totalHosts.length; i++) {
    ip = `${totalUsers[i]}@${totalHosts[i]}`
    hostToIndexMap.set(ip, i)
    nodeIps.push(ip)
    if (
      (i === 0 && parseInt(process.env.TF_VAR_BOR_VALIDATOR_COUNT) > 0) ||
      (i === doc.devnetBorHosts.length &&
        parseInt(process.env.TF_VAR_BOR_VALIDATOR_COUNT) === 0)
    ) {
      isHostMap.set(ip, true)
    } else {
      isHostMap.set(ip, false)
    }
  }

  let command
  const cleanupServicesTasks = nodeIps.map(async (ip) => {
    if (isHostMap.get(ip)) {
      console.log('📍Cleaning up ganache on machine ' + ip + ' ...')
      command =
        'rm -rf ~/data/ganache-db && rm -rf ~/matic-cli/devnet/data/ganache-db'
      await runSshCommand(ip, command, maxRetries)
    }

    console.log('📍Cleaning up heimdall on machine ' + ip + ' ...')
    command = 'heimdalld unsafe-reset-all --home /var/lib/heimdall'
    await runSshCommand(ip, command, maxRetries)

    console.log('📍Purging queue for heimdall bridge on machine ' + ip + ' ...')
    command = 'heimdalld heimdall-bridge --home /var/lib/heimdall purge-queue'
    await runSshCommand(ip, command, maxRetries)

    console.log('📍Resetting heimdall bridge on machine ' + ip + ' ...')
    command =
      'heimdalld heimdall-bridge --home /var/lib/heimdall unsafe-reset-all'
    await runSshCommand(ip, command, maxRetries)

    console.log('📍Cleaning up bridge storage on machine ' + ip + ' ...')
    command = 'rm -rf /var/lib/heimdall/bridge'
    await runSshCommand(ip, command, maxRetries)

    if (hostToIndexMap.get(ip) < doc.devnetBorHosts.length) {
      console.log('📍Cleaning up bor on machine ' + ip + ' ...')
      command = 'rm -rf ~/.bor/data'
      await runSshCommand(ip, command, maxRetries)
    } else {
      console.log('📍Cleaning up erigon on machine ' + ip + ' ...')
      command = 'rm -rf ~/.erigon/data'
      await runSshCommand(ip, command, maxRetries)
    }
  })

  await Promise.all(cleanupServicesTasks)
}

async function startServices(doc) {
  const totalHosts = []
  const totalUsers = []
  const nodeIps = []
  totalUsers.push(
    ...splitToArray(doc.devnetBorUsers.toString()),
    ...splitToArray(doc.devnetErigonUsers.toString())
  )
  totalHosts.push(
    ...splitToArray(doc.devnetBorHosts.toString()),
    ...splitToArray(doc.devnetErigonHosts.toString())
  )
  let ip
  const isHostMap = new Map()
  const hostToIndexMap = new Map()

  for (let i = 0; i < totalHosts.length; i++) {
    ip = `${totalUsers[i]}@${totalHosts[i]}`
    hostToIndexMap.set(ip, i)
    nodeIps.push(ip)
    if (
      (i === 0 && parseInt(process.env.TF_VAR_BOR_VALIDATOR_COUNT) > 0) ||
      (i === doc.devnetBorHosts.length &&
        parseInt(process.env.TF_VAR_BOR_VALIDATOR_COUNT) === 0)
    ) {
      isHostMap.set(ip, true)
    } else {
      isHostMap.set(ip, false)
    }
  }

  let command
  const startServicesTasks = nodeIps.map(async (ip) => {
    if (isHostMap.get(ip)) {
      console.log('📍Running ganache in machine ' + ip + ' ...')
      command = 'sudo systemctl start ganache.service'
      await runSshCommand(ip, command, maxRetries)

      console.log('📍Deploying main net contracts on machine ' + ip + ' ...')
      command = 'cd ~/matic-cli/devnet && bash ganache-deployment.sh'
      await runSshCommand(ip, command, maxRetries)

      console.log('📍Setting up validators on machine ' + ip + ' ...')
      command = 'cd ~/matic-cli/devnet && bash ganache-stake.sh'
      await runSshCommand(ip, command, maxRetries)
    }

    console.log('📍Setting up heimdall on machine ' + ip + ' ...')
    command = 'bash ~/node/heimdalld-setup.sh'
    await runSshCommand(ip, command, maxRetries)

    console.log('📍Starting heimdall on machine ' + ip + ' ...')
    command = 'sudo systemctl start heimdalld.service'
    await runSshCommand(ip, command, maxRetries)

    if (hostToIndexMap.get(ip) < doc.devnetBorHosts.length) {
      console.log('📍Setting bor on machine ' + ip + ' ...')
      command = 'bash ~/node/bor-setup.sh'
      await runSshCommand(ip, command, maxRetries)

      console.log('📍Starting bor on machine ' + ip + ' ...')
      command = 'sudo systemctl start bor.service'
      await runSshCommand(ip, command, maxRetries)
    } else {
      console.log('📍Setting erigon on machine ' + ip + ' ...')
      command = 'bash ~/node/erigon-setup.sh'
      await runSshCommand(ip, command, maxRetries)

      console.log('📍Starting erigon on machine ' + ip + ' ...')
      command = 'sudo systemctl start erigon.service'
      await runSshCommand(ip, command, maxRetries)
    }
  })

  await Promise.all(startServicesTasks)
}

async function deployBorContractsAndStateSync(doc) {
  const user = `${doc.ethHostUser}`
  const borHosts = splitToArray(doc.devnetBorHosts.toString())
  const erigonHosts = splitToArray(doc.devnetErigonHosts.toString())
  const host =
    parseInt(process.env.TF_VAR_BOR_VALIDATOR_COUNT) > 0
      ? borHosts[0]
      : erigonHosts[0]
  const ip = `${user}@${host}`

  console.log('📍Deploying contracts for bor on machine ' + ip + ' ...')
  await timer(60000)
  let command = 'cd ~/matic-cli/devnet && bash ganache-deployment-bor.sh'
  await runSshCommand(ip, command, maxRetries)

  console.log('📍Deploying state-sync contracts on machine ' + ip + ' ...')
  await timer(60000)
  command = 'cd ~/matic-cli/devnet && bash ganache-deployment-sync.sh'
  await runSshCommand(ip, command, maxRetries)
}
