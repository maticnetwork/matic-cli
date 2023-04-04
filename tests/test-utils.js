// export const TxTypes {

// }

export async function fundAccount(
  web3,
  sender,
  accounts,
  maxFeePerGas,
  maxPriorityFeePerGas,
  nonce,
  value
) {
  const tx = {
    from: sender.address,
    to: accounts[0],
    value,
    nonce,
    gasLimit: 22000,
    maxFeePerGas,
    maxPriorityFeePerGas
  }
  await web3.eth.sendTransaction(tx)
}
