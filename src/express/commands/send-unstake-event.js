// noinspection JSUnresolvedVariable

import { loadDevnetConfig } from '../common/config-utils'
import stakeManagerABI from '../../abi/StakeManagerABI.json'
import ERC20ABI from '../../abi/ERC20ABI.json'
import Web3 from 'web3'

const { runScpCommand, maxRetries } = require('../common/remote-worker')

export async function sendUnstakeEvent() {
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

  const MaticTokenAddr = contractAddresses.root.tokens.TestToken
  const MaticTokenContract = new rootChainWeb3.eth.Contract(
    ERC20ABI,
    MaticTokenAddr
  )

  const signerDump = require(`${process.cwd()}/signer-dump.json`)
  const pkey = signerDump[0].priv_key
  const validatorAccount = signerDump[0].address

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
  console.log('Approval Receipt txHash:  ' + approvalReceipt.transactionHash)

  // TODO
  //  replace validatorId to call stakeManager.signerToValidator(validatorAccount)
  const validatorId = 1
  tx = stakeManagerContract.methods.unstake(validatorId)
  signedTx = await getSignedTx(
    rootChainWeb3,
    StakeManagerProxyAddress,
    tx,
    validatorAccount,
    pkey
  )

  const receipt = await rootChainWeb3.eth.sendSignedTransaction(
    signedTx.rawTransaction
  )
  console.log('Unstake Receipt txHash :  ' + receipt.transactionHash)

  // TODO
  //  check validatorsCount
  //  execute the unstake method for 2/3 of nodes
  //  check validatorsCount and make sure it does not change
  //  execute the unstake method for one additional node to reach 2/3 +1
  //  at that point, check the validator count and assert it decreases by 1
}

async function getSignedTx(web3object, to, tx, validatorAccount, privateKey) {
  const gas = await tx.estimateGas({ from: validatorAccount })
  const data = tx.encodeABI()

  const signedTx = await web3object.eth.accounts.signTransaction(
    {
      from: validatorAccount,
      to,
      data,
      gas
    },
    privateKey
  )

  return signedTx
}
