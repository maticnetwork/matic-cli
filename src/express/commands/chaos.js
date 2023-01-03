import { loadDevnetConfig, splitToArray } from '../common/config-utils'
const {
  runScpCommand,
  runSshCommand,
  maxRetries,
  runSshCommandWithoutExit
} = require('../common/remote-worker')

const timer = (ms) => new Promise((res) => setTimeout(res, ms))

async function removeAllPeers(ip, staticNodes) {
  var command = `mv ~/.bor/static-nodes.json ~/.bor/static-nodes.json_bkp`
  try {
    await runSshCommandWithoutExit(ip, command, 1)
  } catch (error) {
    console.log('static-nodes.json already moved')
  }

  var tasks = []
  for (let i = 0; i < staticNodes.length; i++) {
    command = `/home/ubuntu/go/bin/bor attach ~/.bor/data/bor.ipc --exec "admin.removeTrustedPeer('${staticNodes[i]}')"`
    tasks.push(runSshCommand(ip, command, maxRetries))

    command = `/home/ubuntu/go/bin/bor attach ~/.bor/data/bor.ipc --exec "admin.removePeer('${staticNodes[i]}')"`
    tasks.push(runSshCommand(ip, command, maxRetries))
  }
  console.log('📍Removing all peers')
  await Promise.all(tasks)
  console.log('📍Removed all peers')
}

async function addAllPeers(ip, staticNodes) {
  var tasks = []
  for (let i = 0; i < staticNodes.length; i++) {
    var command = `/home/ubuntu/go/bin/bor attach ~/.bor/data/bor.ipc --exec "admin.addPeer('${staticNodes[i]}')"`
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

  require('dotenv').config({ path: `${process.cwd()}/.env` })
  let devnetType = process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  let doc = await loadDevnetConfig(devnetType)

  let borUsers = splitToArray(doc['devnetBorUsers'].toString())
  let borHosts = splitToArray(doc['devnetBorHosts'].toString())

  if (doc['devnetBorHosts'].length > 0) {
    console.log('📍Monitoring the first node', doc['devnetBorHosts'][0])
  } else {
    console.log('📍No nodes to monitor, please check your configs! Exiting...')
    process.exit(1)
  }

  var staticNodes

  try {
    staticNodes = require(`${process.cwd()}/static-nodes.json`)
  } catch (error) {
    let src = `${borUsers[0]}@${borHosts[0]}:~/node/bor/static-nodes.json`
    let dest = `./static-nodes.json`
    await runScpCommand(src, dest, maxRetries)
  }

  staticNodes = require(`${process.cwd()}/static-nodes.json`)
  console.log('📍Static nodes', staticNodes)

  var N = parseInt((doc['devnetBorHosts'].length * intensity) / 15)

  while (true) {
    var exitFlag = false

    process.on('SIGINT', () => {
      exitFlag = true
    })

    if (N < 1 && doc['devnetBorHosts'].length >= 2) {
      N = 1
    }

    console.log('📍Number of nodes to be affected by chaos: ', N)

    var tasks = []
    var ips = []
    for (let i = 0; i < N; i++) {
      let randomIndex = Math.floor(Math.random() * doc['devnetBorHosts'].length)
      let ip = `${borUsers[randomIndex]}@${borHosts[randomIndex]}`
      ips.push(ip)

      tasks.push(removeAllPeers(ip, staticNodes))
    }
    await Promise.all(tasks)

    var chaosDuration = parseInt(intensity * 3000)
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
