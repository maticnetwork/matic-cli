import fs from 'fs'
import { loadDevnetConfig } from '../common/config-utils.js'
import { maxRetries, runScpCommand } from './remote-worker.js'
import Web3 from 'web3'
import dotenv from 'dotenv'
import { createAccountsFromMnemonic } from '../../lib/utils.js'

const EthAmount = '10'

const borProdChainIds = [137, 8001, 8002] // mainnet, mumbai, amoy

export async function fundAnvilAccounts(doc) {
  let machine0
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'
  if (doc === undefined || doc == null) {
    dotenv.config({ path: `${process.cwd()}/.env` })

    doc = await loadDevnetConfig(devnetType)
  } else {
    machine0 = doc.devnetHeimdallHosts[0]
  }

  if (borProdChainIds.includes(doc.borChainId)) {
    console.log('📍Fund anvil accounts only works for devnet')
    console.log('📍Skipping in case of mainnet, mumbai or amoy')
    return
  }

  doc.devnetBorHosts.length > 0
    ? (machine0 = doc.devnetBorHosts[0])
    : (machine0 = doc.devnetErigonHosts[0])

  console.log('📍Transferring funds from anvil account[0] to others...')

  const src = `${doc.ethHostUser}@${machine0}:~/matic-cli/devnet/devnet/signer-dump.json`
  const dest = './signer-dump.json'
  await runScpCommand(src, dest, maxRetries)

  const signerDump = JSON.parse(
    fs.readFileSync(`${process.cwd()}/signer-dump.json`, 'utf8')
  )

  const rootChainWeb3 = new Web3("http://localhost:9545")

  // Default anvil mnemonic
  const defaultAnvilMnemonic =
    'test test test test test test test test test test test junk'

  const accounts = createAccountsFromMnemonic(defaultAnvilMnemonic, 1)
  const defaultAnvilAccount = accounts[0]

  const account = rootChainWeb3.eth.accounts.privateKeyToAccount(
    defaultAnvilAccount.privateKey
  )
  rootChainWeb3.eth.accounts.wallet.add(account)

  // Set default account
  rootChainWeb3.eth.defaultAccount = account.address

  for (let i = 0; i < signerDump.length; i++) {
    const txReceipt = await rootChainWeb3.eth.sendTransaction({
      to: signerDump[i].address,
      from: account.address,
      gas: 21000,
      value: rootChainWeb3.utils.toWei(EthAmount, 'ether')
    })
    console.log(
      '📍Funds transferred from ' +
        defaultAnvilAccount +
        ' to ' +
        signerDump[i].address +
        ' with txHash ' +
        txReceipt.transactionHash
    )
  }
}
