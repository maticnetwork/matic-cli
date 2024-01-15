/* eslint-disable dot-notation */
import { loadDevnetConfig, splitToArray } from '../common/config-utils.js'
import { timer } from '../common/time-utils.js'
import dotenv from 'dotenv'
import fs from 'fs-extra'

import {
  runScpCommand,
  runSshCommand,
  maxRetries,
  runSshCommandWithoutExit
} from '../common/remote-worker.js'

async function removeAllPeers(ip, staticNodes) {
  let command =
    'sudo mv /var/lib/bor/static-nodes.json /var/lib/bor/static-nodes.json_bkp'
  try {
    await runSshCommandWithoutExit(ip, command, 1)
  } catch (error) {
    console.log('static-nodes.json already moved')
  }

  const tasks = []
  for (let i = 0; i < staticNodes.length; i++) {
    command = `~/go/bin/bor attach /var/lib/bor/data/bor.ipc --exec "admin.removeTrustedPeer('${staticNodes[i]}')"`
    tasks.push(runSshCommand(ip, command, maxRetries))

    command = `~/go/bin/bor attach /var/lib/bor/data/bor.ipc --exec "admin.removePeer('${staticNodes[i]}')"`
    tasks.push(runSshCommand(ip, command, maxRetries))
  }
  console.log('📍Removing all peers')
  await Promise.all(tasks)
  console.log('📍Removed all peers')
}

async function addAllPeers(ip, staticNodes) {
  const tasks = []
  for (let i = 0; i < staticNodes.length; i++) {
    const command = `~/go/bin/bor attach /var/lib/bor/data/bor.ipc --exec "admin.addPeer('${staticNodes[i]}')"`
    tasks.push(runSshCommand(ip, command, maxRetries))
  }
  console.log('📍Adding all peers')
  await Promise.all(tasks)
  console.log('📍Added all peers')
}

export async function chaos(intensity) {
  if (intensity > 10) {
    console.log('📍Intensity should be less than 10, set to 10')
    intensity = 10
  }
  console.log('📍Command --chaos [intensity]', intensity)

  dotenv.config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)

  const borUsers = splitToArray(doc['devnetBorUsers'].toString())
  const borHosts = splitToArray(doc['devnetBorHosts'].toString())

  if (doc['devnetBorHosts'].length > 0) {
    console.log('📍Monitoring the first node', doc['devnetBorHosts'][0])
  } else {
    console.log(
      '📍No nodes to monitor since this command is not yet supported for Erigon devnets, please check your configs! Exiting...'
    )
    process.exit(1)
  }

  try {
    JSON.parse(fs.readFileSync(`${process.cwd()}/static-nodes.json`, 'utf8'))
  } catch (error) {
    const src = `${borUsers[0]}@${borHosts[0]}:~/node/bor/static-nodes.json`
    const dest = './static-nodes.json'
    await runScpCommand(src, dest, maxRetries)
  }

  const staticNodes = JSON.parse(
    fs.readFileSync(`${process.cwd()}/static-nodes.json`, 'utf8')
  )
  console.log('📍Static nodes', staticNodes)

  let N = parseInt((doc['devnetBorHosts'].length * intensity) / 15)

  while (true) {
    let exitFlag = false

    process.on('SIGINT', () => {
      exitFlag = true
    })

    if (N < 1 && doc['devnetBorHosts'].length >= 2) {
      N = 1
    }

    console.log('📍Number of nodes to be affected by chaos: ', N)

    let tasks = []
    const ips = []
    for (let i = 0; i < N; i++) {
      const randomIndex = Math.floor(
        Math.random() * doc['devnetBorHosts'].length
      )
      const ip = `${borUsers[randomIndex]}@${borHosts[randomIndex]}`
      ips.push(ip)

      tasks.push(removeAllPeers(ip, staticNodes))
    }
    await Promise.all(tasks)

    const chaosDuration = parseInt(intensity * 3000)
    console.log(chaosDuration, 'ms chaos')
    await timer(chaosDuration)

    tasks = []

    for (let i = 0; i < ips.length; i++) {
      tasks.push(addAllPeers(ips[i], staticNodes))
    }
    await Promise.all(tasks)

    console.log('----------------------------------')

    if (exitFlag) {
      console.log('📍Exiting chaos command')
      break
    }
    await timer(5000)
  }
}
