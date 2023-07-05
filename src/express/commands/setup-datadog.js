// noinspection JSCheckFunctionSignatures,JSUnresolvedVariable

import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import { timer } from '../common/time-utils'
import constants from '../common/constants'

const {
  runScpCommand,
  runSshCommand,
  maxRetries
} = require('../common/remote-worker')
const { installDocker } = require('./start.js')

const yaml = require('js-yaml')
const fs = require('fs')

export async function setDatadogAPIKey(value, doc) {
  if (value !== undefined) {
    doc.exporters.datadog.api.key = value
  }

  fs.writeFile('./otel-config-dd.yaml', yaml.dump(doc), (err) => {
    if (err) {
      console.log('❌ Error while writing datadog YAML configs: \n', err)
      process.exit(1)
    }
  })

  await timer(1000)
}

export async function setupDatadog() {
  let doc
  require('dotenv').config({ path: `${process.cwd()}/.env` })

  if (process.env.TF_VAR_DOCKERIZED === 'yes') {
    console.log('📍Not supported for datadog at the moment')
    return
  } else {
    doc = await loadDevnetConfig('remote')
  }

  if (doc.cloud.toString() === constants.cloud.GCP) { 
    // not tested datadog setup in GCP
    console.log('📍Not supported for datadog at the moment in GCP')
    return
  }

  if (doc.devnetBorHosts.length > 0) {
    console.log('📍Monitoring the nodes', doc.devnetBorHosts[0])
  } else {
    console.log(
      '📍No nodes to monitor since this command is not yet supported on Erigon devnets, please check your configs! Exiting...'
    )
    process.exit(1)
  }

  const borUsers = splitToArray(doc.devnetBorUsers.toString())
  let envName

  for (let i = 0; i < doc.devnetBorHosts.length; i++) {
    const host = doc.devnetBorHosts[i]
    const user = borUsers[i]

    console.log('📍Monitoring the node', host)

    const apiKey = process.env.DD_API_KEY
    envName = process.env.TF_VAR_VM_NAME
    if (envName === undefined) {
      const x = parseInt((Math.random() * 1000000).toString())
      envName = `devnet-${x}`
    }

    console.log('📍Setting up datadog for', envName)
    let command = `DD_API_KEY=${apiKey} DD_SITE="datadoghq.com" DD_HOST_TAGS="env:${envName}" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"`
    await runSshCommand(`${user}@${host}`, command, maxRetries)
    console.log(`📍Datadog installed on ${host}`)

    await installDocker(`${user}@${host}`, user)
    console.log('📍Docker installed')

    const datadogConfig = await yaml.load(
      fs.readFileSync('./otel-config-dd.yaml', 'utf8'),
      undefined
    )
    await setDatadogAPIKey(apiKey, datadogConfig)

    let src = './otel-config-dd.yaml'
    let dest = `${user}@${host}:~/otel-config-dd.yaml`
    await runScpCommand(src, dest, maxRetries)

    src = './openmetrics-conf.yaml'
    dest = `${user}@${host}:~/conf.yaml`
    await runScpCommand(src, dest, maxRetries)

    command =
      'sudo mv ~/conf.yaml /etc/datadog-agent/conf.d/openmetrics.d/conf.yaml'
    await runSshCommand(`${user}@${host}`, command, maxRetries)

    command =
      'sudo docker run -d --net=host -v ~/otel-config-dd.yaml:/otel-local-config.yaml otel/opentelemetry-collector-contrib --config otel-local-config.yaml'
    await runSshCommand(`${user}@${host}`, command, maxRetries)
    console.log(`📍OpenCollector started on ${host}`)

    command = 'sudo service datadog-agent restart'
    await runSshCommand(`${user}@${host}`, command, maxRetries)

    // revert dd api key
    // eslint-disable-next-line no-undef, no-template-curly-in-string
    await setDatadogAPIKey('${DD_API_KEY}', datadogConfig)
  }

  console.log('📍Datadog devnet env : ', envName)
  console.log('📍Datadog setup complete')
}
