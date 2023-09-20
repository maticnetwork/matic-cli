// noinspection JSCheckFunctionSignatures,JSUnresolvedVariable

import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import { timer } from '../common/time-utils'
import constants from '../common/constants'

const {
  runScpCommand,
  runSshCommand,
  maxRetries
} = require('../common/remote-worker')

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
    console.log('📍Datadog setup currently not supported in GCP')
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

    // Setup datadog-agent
    console.log('📍Setting up datadog for', envName)
    let command = `DD_API_KEY=${apiKey} DD_SITE="datadoghq.com" DD_HOST_TAGS="env:${envName}" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"`
    await runSshCommand(`${user}@${host}`, command, maxRetries)
    console.log(`📍Datadog installed on ${host}`)

    // Copy the DD config
    console.log('📍Copying the datadog config')
    let src = './openmetrics-conf.yaml'
    let dest = `${user}@${host}:~/conf.yaml`
    await runScpCommand(src, dest, maxRetries)

    command =
      'sudo mv ~/conf.yaml /etc/datadog-agent/conf.d/openmetrics.d/conf.yaml'
    await runSshCommand(`${user}@${host}`, command, maxRetries)

    // Restart the datadog-agent
    console.log('📍Restarting the datadog agent')
    command = 'sudo service datadog-agent restart'
    await runSshCommand(`${user}@${host}`, command, maxRetries)

    // Setup otel collector service
    console.log('📍Setting up otel collector for', envName)
    src = './install-otelcol-contrib.sh'
    dest = `${user}@${host}:~/install-otelcol-contrib.sh`
    await runScpCommand(src, dest, maxRetries)

    // Install otel collector using the script
    command = 'sudo bash ~/install-otelcol-contrib.sh'
    await runSshCommand(`${user}@${host}`, command, maxRetries)

    // Set the datadog api key in the otel config
    console.log(
      '📍Setting up datadog api key in otel config and copying the config'
    )
    const otelConfig = await yaml.load(
      fs.readFileSync('./otel-config-dd.yaml', 'utf8'),
      undefined
    )
    await setDatadogAPIKey(apiKey, otelConfig)

    // Copy the otel config
    src = './otel-config-dd.yaml'
    dest = `${user}@${host}:~/otel-config-dd.yaml`
    await runScpCommand(src, dest, maxRetries)

    command = 'sudo mv ~/otel-config-dd.yaml /etc/otelcol-contrib/config.yaml'
    await runSshCommand(`${user}@${host}`, command, maxRetries)

    // Restart the otel service
    console.log('📍Restarting the otel service')
    command =
      'sudo systemctl daemon-reload && sudo service otelcol-contrib restart'
    await runSshCommand(`${user}@${host}`, command, maxRetries)

    // Remove the installation script
    command = 'rm ~/install-otelcol-contrib.sh'
    await runSshCommand(`${user}@${host}`, command, maxRetries)

    // revert dd api key
    // eslint-disable-next-line no-undef, no-template-curly-in-string
    await setDatadogAPIKey('${DD_API_KEY}', otelConfig)
  }

  console.log('📍Datadog devnet env:', envName)
  console.log('📍Datadog and otel collector setup complete')
}
