import fs from 'fs'
import { maxRetries, runScpCommand } from './remote-worker.js'
import Web3 from 'web3'

const EthAmount = '10'

// Since we might reset and restart ganache multiple times during the setup,
// and  considered that ganache is no longer maintained, plus
// it is affected by this issue https://github.com/trufflesuite/ganache/issues/4404
// we implemented this workaround waiting for a migration to hardhat
// (see internal issue https://polygon.atlassian.net/browse/POS-1869)
export async function fundGanacheAccounts(doc) {
  let machine0
  if (doc.devnetBorHosts) {
    machine0 = doc.devnetBorHosts[0]
  } else {
    machine0 = doc.devnetErigonHosts[0]
  }

  console.log('📍Transferring funds from ganache account[0] to others...')
  const src = `${doc.ethHostUser}@${machine0}:~/matic-cli/devnet/devnet/signer-dump.json`
  const dest = './signer-dump.json'
  await runScpCommand(src, dest, maxRetries)

  const signerDump = JSON.parse(
    fs.readFileSync(`${process.cwd()}/signer-dump.json`, 'utf8')
  )

  const rootChainWeb3 = new Web3(`http://${machine0}:9545`)

  for (let i = 1; i < signerDump.length; i++) {
    const txReceipt = await rootChainWeb3.eth.sendTransaction({
      to: signerDump[i].address,
      from: signerDump[0].address,
      value: rootChainWeb3.utils.toWei(EthAmount, 'ether')
    })
    console.log(
      '📍Funds transferred from ' +
        signerDump[0].address +
        ' to ' +
        signerDump[i].address +
        ' with txHash ' +
        txReceipt.transactionHash
    )
  }
}
