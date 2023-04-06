import { loadDevnetConfig } from '../common/config-utils'
import stakeManagerABI from '../../abi/StakeManagerABI.json'
import ERC20ABI from '../../abi/ERC20ABI.json'
import Web3 from 'web3'
import Wallet, { hdkey } from 'ethereumjs-wallet'
import { timer } from '../common/time-utils'
import { getSignedTx } from '../common/tx-utils'
import { isValidatorIdCorrect } from '../common/validators-utils'

const {
  runScpCommand,
  runSshCommandWithReturn,
  maxRetries
} = require('../common/remote-worker')

export async function sendStakedEvent(validatorID) {
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)

  if (!isValidatorIdCorrect(validatorID, doc.numOfValidators)) {
    console.log(
      '📍Invalid validatorID used, please try with a valid argument! Exiting...'
    )
    process.exit(1)
  }
  if (doc.devnetBorHosts.length > 0) {
    console.log('📍Monitoring the first node', doc.devnetBorHosts[0])
  } else {
    console.log('📍No nodes to monitor, please check your configs! Exiting...')
    process.exit(1)
  }

  validatorID = Number(validatorID)

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

  const MaticTokenAddr = contractAddresses.root.tokens.TestToken
  const MaticTokenContract = new rootChainWeb3.eth.Contract(
    ERC20ABI,
    MaticTokenAddr
  )

  const signerDump = require(`${process.cwd()}/signer-dump.json`)
  const pkey = signerDump[validatorID - 1].priv_key
  const validatorAccount = signerDump[validatorID - 1].address
  const stakeAmount = rootChainWeb3.utils.toWei('12')
  const heimdallFee = rootChainWeb3.utils.toWei('12')

  const stakeManagerContract = new rootChainWeb3.eth.Contract(
    stakeManagerABI,
    StakeManagerProxyAddress
  )

  let tx = MaticTokenContract.methods.approve(
    StakeManagerProxyAddress,
    rootChainWeb3.utils.toWei('50')
  )
  let signedTx = await getSignedTx(
    rootChainWeb3,
    MaticTokenAddr,
    tx,
    validatorAccount,
    pkey
  )

  const approvalReceipt = await rootChainWeb3.eth.sendSignedTransaction(
    signedTx.rawTransaction
  )
  console.log('Approval Receipt txHash:  ' + approvalReceipt.transactionHash)

  const RandomSeed = 'random' + Math.random()
  const newAccPrivKey = hdkey.fromMasterSeed(RandomSeed)._hdkey._privateKey
  const wallet = Wallet.fromPrivateKey(newAccPrivKey)
  const newAccAddr = wallet.getAddressString()
  const newAccPubKey = wallet.getPublicKeyString()

  console.log('NewValidatorAddr', newAccAddr, newAccPubKey)
  console.log('NewValidatorPrivKey', wallet.getPrivateKeyString())

  tx = stakeManagerContract.methods.stakeFor(
    newAccAddr,
    stakeAmount,
    heimdallFee,
    false,
    newAccPubKey
  )
  signedTx = await getSignedTx(
    rootChainWeb3,
    StakeManagerProxyAddress,
    tx,
    validatorAccount,
    pkey
  )

  const oldValidatorsCount = await checkValidatorsLength(doc)
  console.log('oldValidatorsCount : ', oldValidatorsCount)

  const receipt = await rootChainWeb3.eth.sendSignedTransaction(
    signedTx.rawTransaction
  )
  console.log('StakeFor Receipt txHash :  ' + receipt.transactionHash)

  let newValidatorsCount = await checkValidatorsLength(doc)

  while (parseInt(newValidatorsCount) !== parseInt(oldValidatorsCount) + 1) {
    console.log('Waiting 3 secs for validator to be added')
    await timer(3000) // waiting 3 secs
    newValidatorsCount = await checkValidatorsLength(doc)
    console.log('newValidatorsCount : ', newValidatorsCount)
  }

  console.log('✅ Validator Added')
  console.log(
    '✅ Staked Event sent from rootchain, received and processed on Heimdall'
  )
}

export async function checkValidatorsLength(doc) {
  const machine0 = doc.devnetBorHosts[0]
  const command = 'curl localhost:1317/staking/validator-set'
  const out = await runSshCommandWithReturn(
    `${doc.ethHostUser}@${machine0}`,
    command,
    maxRetries
  )
  const outObj = JSON.parse(out)
  return outObj.result.validators.length
}
