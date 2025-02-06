import { loadDevnetConfig } from '../common/config-utils.js'
import { timer } from '../common/time-utils.js'
import { isValidatorIdCorrect } from '../common/validators-utils.js'

import {
  runScpCommand,
  runSshCommand,
  runSshCommandWithReturn,
  maxRetries
} from '../common/remote-worker.js'

import dotenv from 'dotenv'
import fs from 'fs-extra'

export async function sendTopUpFeeEvent(validatorID) {
  dotenv.config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)
  let machine0
  // const fundingKey =
  // '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

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

  let src = `${doc.ethHostUser}@${machine0}:~/matic-cli/devnet/devnet/signer-dump.json`
  let dest = './signer-dump.json'
  await runScpCommand(src, dest, maxRetries)

  src = `${doc.ethHostUser}@${machine0}:~/matic-cli/devnet/code/pos-contracts/contractAddresses.json`
  dest = './contractAddresses.json'
  await runScpCommand(src, dest, maxRetries)

  const contractAddresses = JSON.parse(
    fs.readFileSync(`${process.cwd()}/contractAddresses.json`, 'utf8')
  )

  const StakeManagerProxyAddress = contractAddresses.root.StakeManagerProxy

  const MaticTokenAddr = contractAddresses.root.tokens.MaticToken
  console.log('address')
  console.log(MaticTokenAddr)

  const signerDump = JSON.parse(
    fs.readFileSync(`${process.cwd()}/signer-dump.json`, 'utf8')
  )
  const pkey = signerDump[validatorID - 1].priv_key
  const validatorAccount = signerDump[validatorID - 1].address
  console.log(signerDump[validatorID - 1].address)

  console.log('📍 Sending MATIC-TOKENS to validators account')
  let command = `export PATH="$HOME/.foundry/bin:$PATH" && cast send ${MaticTokenAddr} "transfer(address,uint256)" ${validatorAccount} 100000000000000000000 --rpc-url http://localhost:9545 --private-key ${signerDump[0].priv_key}`
  await runSshCommand(`${doc.ethHostUser}@${machine0}`, command, maxRetries)
  console.log('done!')

  await timer(12000)

  command = `export PATH="$HOME/.foundry/bin:$PATH" && cast send ${MaticTokenAddr} "approve(address,uint256)" ${StakeManagerProxyAddress} 100000000000000000000 --rpc-url http://localhost:9545 --private-key ${pkey}`
  await runSshCommand(`${doc.ethHostUser}@${machine0}`, command, maxRetries)
  console.log('done!')

  // let tx = MaticTokenContract.methods.approve(
  //  StakeManagerProxyAddress,
  //  rootChainWeb3.utils.toWei('1000')
  // )
  // let signedTx = await getSignedTx(
  //  rootChainWeb3,
  //  MaticTokenAddr,
  //  tx,
  //  validatorAccount,
  //  pkey
  // )
  // const approvalReceipt = await rootChainWeb3.eth.sendSignedTransaction(
  //  signedTx.rawTransaction
  // )
  // console.log(
  //  '\n\nApproval Receipt txHash:  ' + approvalReceipt.transactionHash
  // )

  // Adding 100 MATIC stake
  // tx = stakeManagerContract.methods.topUpForFee(
  //  validatorAccount,
  //  rootChainWeb3.utils.toWei('100')
  // )
  //
  const oldValidatorBalance = await getValidatorBalance(
    doc,
    machine0,
    validatorAccount
  )
  console.log('Waiting 20 sec...')
  await timer(20000)

  console.log('Old Validator Balance:  ' + oldValidatorBalance)
  command = `export PATH="$HOME/.foundry/bin:$PATH" && cast send ${StakeManagerProxyAddress} "topUpForFee(address,uint256)" ${validatorAccount} 10000000000000000000 --rpc-url http://localhost:9545 --private-key ${pkey}`
  await runSshCommand(`${doc.ethHostUser}@${machine0}`, command, maxRetries)
  console.log('done!')
  //
  //
  //
  //
  //
  // signedTx = await getSignedTx(
  // rootChainWeb3,
  // StakeManagerProxyAddress,
  // tx,
  // validatorAccount,
  // pkey
  // )
  // try{
  // const Receipt = await rootChainWeb3.eth.sendSignedTransaction(
  //  signedTx.rawTransaction
  // )
  //  return Receipt
  // } catch (error){
  //  console.error(`❌ Error in :`, error)
  // }
  // console.log('TopUpForFee Receipt txHash:  ' + Receipt.transactionHash)

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
  const command = `curl http://localhost:1317/cosmos/bank/v1beta1/balances/${valAddr}`
  const out = await runSshCommandWithReturn(
    `${doc.ethHostUser}@${machine0}`,
    command,
    maxRetries
  )
  const outObj = JSON.parse(out)
  return outObj.balances[0].amount
}
