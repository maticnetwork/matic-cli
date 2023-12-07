import { loadDevnetConfig } from '../common/config-utils.js'
import Web3 from 'web3'
import { getSignedTx } from '../common/tx-utils.js'
import { timer } from '../common/time-utils.js'
import Wallet from 'ethereumjs-wallet'
import stakeManagerABI from '../../abi/StakeManagerABI.json' assert { type: 'json' }

import { isValidatorIdCorrect } from '../common/validators-utils.js'

import {
  runScpCommand,
  runSshCommandWithReturn,
  maxRetries
} from '../common/remote-worker.js'

import dotenv from 'dotenv'
import fs from 'fs-extra'
const { hdkey } = Wallet

export async function sendSignerChangeEvent(validatorID) {
  dotenv.config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)
  let machine0

  if (
    !isValidatorIdCorrect(
      validatorID,
      doc.numOfBorValidators + doc.numOfErigonValidators
    )
  ) {
    console.log(
      '📍Invalid validatorID used, please try with a valid argument! Exiting...'
    )
    process.exit(1)
  }
  if (doc.numOfBorValidators > 0) {
    machine0 = doc.devnetBorHosts[0]
    console.log('📍Monitoring the first node', doc.devnetBorHosts[0])
  } else if (devnetType === 'remote') {
    machine0 = doc.devnetErigonHosts[0]
    console.log('📍Monitoring the first node', doc.devnetErigonHosts[0])
  } else {
    console.log('📍No nodes to monitor, please check your configs! Exiting...')
    process.exit(1)
  }

  validatorID = Number(validatorID)
  const rootChainWeb3 = new Web3(`http://${machine0}:9545`)

  let src = `${doc.ethHostUser}@${machine0}:~/matic-cli/devnet/devnet/signer-dump.json`
  let dest = './signer-dump.json'
  await runScpCommand(src, dest, maxRetries)

  src = `${doc.ethHostUser}@${machine0}:~/matic-cli/devnet/code/contracts/contractAddresses.json`
  dest = './contractAddresses.json'
  await runScpCommand(src, dest, maxRetries)

  const contractAddresses = JSON.parse(
    fs.readFileSync(`${process.cwd()}/contractAddresses.json`, 'utf8')
  )

  const StakeManagerProxyAddress = contractAddresses.root.StakeManagerProxy

  const signerDump = JSON.parse(
    fs.readFileSync(`${process.cwd()}/signer-dump.json`, 'utf8')
  )
  const pkey = signerDump[validatorID - 1].priv_key
  const validatorAccount = signerDump[validatorID - 1].address

  const stakeManagerContract = new rootChainWeb3.eth.Contract(
    stakeManagerABI,
    StakeManagerProxyAddress
  )

  const oldSigner = await getValidatorSigner(doc, machine0, validatorID)
  console.log('OldValidatorSigner', oldSigner)

  const RandomSeed = 'random' + Math.random()
  const newAccPrivKey = hdkey.fromMasterSeed(RandomSeed)._hdkey._privateKey
  const wallet = Wallet.default.fromPrivateKey(newAccPrivKey)
  const newAccAddr = wallet.getAddressString()
  const newAccPubKey = wallet.getPublicKeyString()

  console.log('NewValidatorAddr', newAccAddr, newAccPubKey)
  console.log('NewValidatorPrivKey', wallet.getPrivateKeyString())

  const tx = stakeManagerContract.methods.updateSigner(
    validatorID,
    newAccPubKey
  )
  const signedTx = await getSignedTx(
    rootChainWeb3,
    StakeManagerProxyAddress,
    tx,
    validatorAccount,
    pkey
  )
  const Receipt = await rootChainWeb3.eth.sendSignedTransaction(
    signedTx.rawTransaction
  )
  console.log('UpdateSigner Receipt', Receipt.transactionHash)

  let newSigner = await getValidatorSigner(doc, machine0, validatorID)

  while (newSigner === oldSigner) {
    console.log('Waiting 3 secs for signer to be updated')
    await timer(3000) // waiting 3 secs
    newSigner = await getValidatorSigner(doc, machine0, validatorID)
    console.log('newSigner : ', newSigner)
  }

  console.log('✅ Signer Updated')
  console.log(
    '✅ SignerChange Event event from rootchain, received and processed on Heimdall'
  )
}

async function getValidatorSigner(doc, machine0, validatorID) {
  const command = `curl localhost:1317/staking/validator/${validatorID}`
  const out = await runSshCommandWithReturn(
    `${doc.ethHostUser}@${machine0}`,
    command,
    maxRetries
  )
  const outObj = JSON.parse(out)
  return outObj.result.signer
}
