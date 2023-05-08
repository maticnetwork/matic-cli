// noinspection JSCheckFunctionSignatures,JSUnresolvedVariable

import { loadDevnetConfig, splitToArray } from '../common/config-utils'
const {
  runSshCommand,
  maxRetries,
  runSshCommandWithReturnWithoutExit
} = require('../common/remote-worker')
const { installDocker } = require('./start.js')

const startFileLocation = '~/node/bor-start.sh'
let addEthstatsFlagCommand = ''

export async function setupEthstats() {
  console.log('📍Setting up Ethstats backend...')
  let doc
  require('dotenv').config({ path: `${process.cwd()}/.env` })

  if (process.env.TF_VAR_DOCKERIZED === 'yes') {
    console.log('📍Not supported for Ethstats at the moment')
    return
  } else {
    doc = await loadDevnetConfig('remote')
  }

  if (doc.devnetBorHosts.length > 0) {
    console.log('📍Monitoring the nodes', doc.devnetBorHosts[0])
  } else {
    console.log('📍No nodes to monitor, please check your configs! Exiting...')
    process.exit(1)
  }

  const borUsers = splitToArray(doc.devnetBorUsers.toString())

  const host0 = doc.devnetBorHosts[0]
  const user0 = borUsers[0]

  console.log('📍Monitoring the node', host0)

  await installDocker(`${user0}@${host0}`, user0)
  console.log('📍Docker installed')

  console.log('📍Cloning ethstats-backend')
  let command = 'git clone https://github.com/maticnetwork/ethstats-backend.git && cd ethstats-backend'
  await runSshCommand(`${user0}@${host0}`, command, maxRetries)

  console.log('📍Installing ethstats-backend deps')
  command = 'cd ethstats-backend && go mod tidy'
  await runSshCommand(`${user0}@${host0}`, command, maxRetries)

  console.log('📍Cloning ethstats-frontend')
  command = 'git clone https://github.com/maticnetwork/reorgs-frontend.git'
  await runSshCommand(`${user0}@${host0}`, command, maxRetries)

  console.log('📍Installing ethstats-frontend deps')
  command = 'cd reorgs-frontend && git checkout express-cli && npm install'
  await runSshCommand(`${user0}@${host0}`, command, maxRetries)

  console.log('📍Building ethstats-frontend docker image')
  command = `cd reorgs-frontend && sudo docker build -t ethstats-frontend . --build-arg REACT_APP_BACKEND=http://${host0}:8080`
  await runSshCommand(`${user0}@${host0}`, command, maxRetries)

  console.log('📍Building ethstats-backend docker image')
  command = 'cd ethstats-backend && sudo docker build -t ethstats-backend .'
  await runSshCommand(`${user0}@${host0}`, command, maxRetries)

  console.log('📍Starting ethstats docker environment')
  command = 'sudo apt install docker-compose -y && cd ethstats-backend && sudo docker-compose up -d'
  console.log(command)
  await runSshCommand(`${user0}@${host0}`, command, maxRetries)

  for (let i = 0; i < doc.devnetBorHosts.length; i++) {
    const host = doc.devnetBorHosts[i]
    const user = borUsers[i]
    let ethstatsFlag = false

    command = `cat ${startFileLocation} | grep -i ethstats`

    ethstatsFlag = await runSshCommandWithReturnWithoutExit(`${user}@${host}`, command, maxRetries)
    if (ethstatsFlag) {
      console.log('📍Ethstats flag already added')
    } else {
      addEthstatsFlagCommand = `sed -i 's,--maxpeers 200,--maxpeers 200 \\\\\\\n  --ethstats node${i}:hello@${host0}:8000,g' ${startFileLocation}`
      await runSshCommand(`${user}@${host}`, addEthstatsFlagCommand, maxRetries)
      console.log('📍Ethstats flag added')
    }

    console.log('📍Restarting bor service')
    command = 'sudo service bor restart'
    await runSshCommand(`${user}@${host}`, command, maxRetries)
    console.log('📍Bor service restarted')
  }

  console.log(`\n\nSteps : \n 
  1. Open Hasura Console in your browser \n
  2. Click on settings on top-right corner \n
  3. Click on "import metadata" \n
  4. Select the file configs/devnet/hasura_metadata_example.json \n
  5. Open Reorgs-Frontend\n\n
  `)

  console.log(`Hasura Console : http://${host0}:8080`)
  console.log(`Reorgs Frontend : http://${host0}:3000`)
  console.log(`Ethstats Backend Endpoint : http://${host0}:8000`)

  console.log('\n\n📍Ethstats setup complete\n')
}
