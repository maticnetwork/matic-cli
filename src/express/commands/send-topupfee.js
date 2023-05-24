import { loadDevnetConfig } from '../common/config-utils'
import stakeManagerABI from '../../abi/StakeManagerABI.json'
import ERC20ABI from '../../abi/ERC20ABI.json'
import Web3 from 'web3'
import { timer } from '../common/time-utils'
import { getSignedTx } from '../common/tx-utils'
import { isValidatorIdCorrect } from '../common/validators-utils'

const {
  runScpCommand,
  runSshCommandWithReturn,
  maxRetries
} = require('../common/remote-worker')

export async function sendTopUpFeeEvent(validatorID) {
  require('dotenv').config({ path: `${process.cwd()}/.env` })
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

  const stakeManagerContract = new rootChainWeb3.eth.Contract(
    stakeManagerABI,
    StakeManagerProxyAddress
  )

  let tx = MaticTokenContract.methods.approve(
    StakeManagerProxyAddress,
    rootChainWeb3.utils.toWei('1000')
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
  console.log(
    '\n\nApproval Receipt txHash:  ' + approvalReceipt.transactionHash
  )

  // Adding 100 MATIC stake
  tx = stakeManagerContract.methods.topUpForFee(
    validatorAccount,
    rootChainWeb3.utils.toWei('100')
  )

  const oldValidatorBalance = await getValidatorBalance(
    doc,
    machine0,
    validatorAccount
  )
  console.log('Old Validator Balance:  ' + oldValidatorBalance)

  signedTx = await getSignedTx(
    rootChainWeb3,
    StakeManagerProxyAddress,
    tx,
    validatorAccount,
    pkey
  )
  const Receipt = await rootChainWeb3.eth.sendSignedTransaction(
    signedTx.rawTransaction
  )
  console.log('TopUpForFee Receipt txHash:  ' + Receipt.transactionHash)

  let newValidatorBalance = await getValidatorBalance(
    doc,
    machine0,
    validatorAccount
  )

  while (parseInt(newValidatorBalance) <= parseInt(oldValidatorBalance)) {
    console.log('Waiting 3 secs for topupfee')
    await timer(3000) // waiting 3 secs
    newValidatorBalance = await getValidatorBalance(
      doc,
      machine0,
      validatorAccount
    )
    console.log('newValidatorBalance : ', newValidatorBalance)
  }

  console.log('✅ Topup Done')
  console.log(
    '✅ TopUpFee event Sent from Rootchain and Received and processed on Heimdall'
  )
}

async function getValidatorBalance(doc, machine0, valAddr) {
  const command = `curl http://localhost:1317/bank/balances/${valAddr}`
  const out = await runSshCommandWithReturn(
    `${doc.ethHostUser}@${machine0}`,
    command,
    maxRetries
  )
  const outObj = JSON.parse(out)
  return outObj.result[0].amount
}
