import { loadDevnetConfig } from '../common/config-utils.js'
import { timer } from '../common/time-utils.js'
import { isValidatorIdCorrect } from '../common/validators-utils.js'
import {
  runScpCommand,
  runSshCommand,
  runSshCommandWithReturn,
  maxRetries
} from '../common/remote-worker.js'
import {
  importValidatorKeysOnHost,
  fetchBalance
} from '../common/heimdall-utils.js'
import dotenv from 'dotenv'
import fs from 'fs-extra'

export async function sendTopUpFeeEvent(validatorID) {
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

  const signerDump = JSON.parse(
    fs.readFileSync(`${process.cwd()}/signer-dump.json`, 'utf8')
  )
  const pkey = signerDump[validatorID - 1].priv_key
  const validatorAccount = signerDump[validatorID - 1].address
  console.log(validatorAccount)

  console.log('📍Sending Matic Tokens to validators account')
  let command = `export PATH="$HOME/.foundry/bin:$PATH" && cast send ${MaticTokenAddr} "transfer(address,uint256)" ${validatorAccount} 100000000000000000000 --rpc-url http://localhost:9545 --private-key ${signerDump[0].priv_key}`
  await runSshCommand(`${doc.ethHostUser}@${machine0}`, command, maxRetries)

  console.log('📍Waiting 5 secs for token transaction to be processed')
  await timer(5000)

  command = `export PATH="$HOME/.foundry/bin:$PATH" && cast send ${MaticTokenAddr} "approve(address,uint256)" ${StakeManagerProxyAddress} 100000000000000000000 --rpc-url http://localhost:9545 --private-key ${pkey}`
  await runSshCommand(`${doc.ethHostUser}@${machine0}`, command, maxRetries)

  const oldValidatorBalance = await fetchBalance(
    doc.ethHostUser,
    machine0,
    validatorAccount
  )
  console.log('Waiting 5 secs for Matic Token Approval')
  await timer(5000)

  console.log('Old Validator Balance:' + oldValidatorBalance)
  command = `export PATH="$HOME/.foundry/bin:$PATH" && cast send ${StakeManagerProxyAddress} "topUpForFee(address,uint256)" ${validatorAccount} 10000000000000000000 --rpc-url http://localhost:9545 --private-key ${pkey}`
  await runSshCommand(`${doc.ethHostUser}@${machine0}`, command, maxRetries)

  let newValidatorBalance = await fetchBalance(
    doc.ethHostUser,
    machine0,
    validatorAccount
  )

  while (parseInt(newValidatorBalance) <= parseInt(oldValidatorBalance)) {
    console.log('Waiting 5 secs for topupfee')
    await timer(5000)
    newValidatorBalance = await fetchBalance(
      doc.ethHostUser,
      machine0,
      validatorAccount
    )
    console.log('newValidatorBalance:', newValidatorBalance)
  }

  console.log('✅ Topup Done')
  console.log(
    '✅ TopUpFee event Sent from Rootchain and Received and processed on Heimdall'
  )

  if (Array.isArray(doc.devnetBorHosts) && doc.devnetBorHosts.length > 0) {
    for (const machine of doc.devnetBorHosts) {
      await importValidatorKeysOnHost(machine, doc.ethHostUser)
    }
  }

  if (
    Array.isArray(doc.devnetErigonHosts) &&
    doc.devnetErigonHosts.length > 0
  ) {
    for (const machine of doc.devnetErigonHosts) {
      await importValidatorKeysOnHost(machine, doc.ethHostUser)
    }
  }
  console.log('📍Validator keys imported on all hosts')

  // --- Withdraw Fee Logic ---
  const chainId = await runSshCommandWithReturn(
    `${doc.ethHostUser}@${machine0}`,
    "jq -r '.chain_id' /var/lib/heimdall/config/genesis.json",
    maxRetries
  )
  console.log('Chain ID:', chainId.trim())

  const balanceBeforeWithdraw = await fetchBalance(
    doc.ethHostUser,
    machine0,
    validatorAccount
  )
  console.log('Balance before withdraw:', balanceBeforeWithdraw)

  const withdrawAmount = '100000000000000000000'
  console.log('📍Withdrawing fee:', withdrawAmount)
  const withdrawCmd = `
    printf 'test-test\\n' | heimdalld tx topup withdraw-fee ${validatorAccount} ${withdrawAmount} \
    --from test \
    --chain-id ${chainId.trim()} \
    --home /var/lib/heimdall \
    -y
  `
    .trim()
    .replace(/\s+/g, ' ')
  await runSshCommand(`${doc.ethHostUser}@${machine0}`, withdrawCmd, maxRetries)
  console.log('✅ Withdraw transaction submitted')

  await timer(5000)

  let balanceAfterWithdraw = await fetchBalance(
    doc.ethHostUser,
    machine0,
    validatorAccount
  )

  while (BigInt(balanceAfterWithdraw) >= BigInt(balanceBeforeWithdraw)) {
    console.log('Waiting 5 secs for withdrawal to process')
    await timer(5000)
    balanceAfterWithdraw = await fetchBalance(
      doc.ethHostUser,
      machine0,
      validatorAccount
    )
  }
  console.log('Balance after withdraw:', balanceAfterWithdraw)
  console.log('✅ Withdraw successful')
}
