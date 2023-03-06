// noinspection JSUnresolvedVariable

import { loadDevnetConfig } from '../common/config-utils'
import stakeManagerABI from '../../abi/StakeManagerABI.json'
import Web3 from 'web3'
import { getSignedTx } from '../common/tx-utils'
import { timer } from '../common/time-utils'
import { checkValidatorsLength } from './send-staked-event'

const {
  runScpCommand,
  maxRetries
} = require('../common/remote-worker')

export async function sendUnstakeInitEvent() {
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)

  if (doc.devnetBorHosts.length > 0) {
    console.log('📍Monitoring the first node', doc.devnetBorHosts[0])
  } else {
    console.log('📍No nodes to monitor, please check your configs! Exiting...')
    process.exit(1)
  }

  const machine0 = doc.devnetBorHosts[0]
  const rootChainWeb3 = new Web3(`http://${machine0}:9545`)

  let src = `${doc.ethHostUser}@${machine0}:~/matic-cli/devnet/devnet/signer-dump.json`
  let dest = './signer-dump.json'
  await runScpCommand(src, dest, maxRetries)

  src = `${doc.ethHostUser}@${machine0}:~/matic-cli/devnet/code/contracts/contractAddresses.json`
  dest = './contractAddresses.json'
  await runScpCommand(src, dest, maxRetries)

  const contractAddresses = require(`${process.cwd()}/contractAddresses.json`)

  const StakeManagerProxyAddress = contractAddresses.root.StakeManagerProxy

  const signerDump = require(`${process.cwd()}/signer-dump.json`)
  const pkey = signerDump[0].priv_key
  const validatorAccount = signerDump[0].address
  const validatorIDForTest = '1'

  const stakeManagerContract = new rootChainWeb3.eth.Contract(
    stakeManagerABI,
    StakeManagerProxyAddress
  )

  const tx = stakeManagerContract.methods.unstake(
    validatorIDForTest
  )
  const signedTx = await getSignedTx(
    rootChainWeb3,
    StakeManagerProxyAddress,
    tx,
    validatorAccount,
    pkey
  )

  const oldValidatorsCount = await checkValidatorsLength(doc)
  console.log('oldValidatorsCount : ', oldValidatorsCount)

  const Receipt = await rootChainWeb3.eth.sendSignedTransaction(
    signedTx.rawTransaction
  )
  console.log('Unstake Receipt', Receipt.transactionHash)

  let newValidatorsCount = await checkValidatorsLength(doc)

  while (parseInt(newValidatorsCount) !== parseInt(oldValidatorsCount) - 1) {
    console.log('Waiting 3 secs for validator to be removed')
    await timer(3000) // waiting 3 secs
    newValidatorsCount = await checkValidatorsLength(doc)
    console.log('newValidatorsCount : ', newValidatorsCount)
  }

  console.log('✅ Validator Unstake Done')
  console.log(
    '✅ UnstakeInit Event Sent from Rootchain and Received and processed on Heimdall'
  )
}
