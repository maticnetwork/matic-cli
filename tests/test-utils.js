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

export function sanitizeIterations(iter) {
  if (iter <= 0 || iter === null || iter === undefined) {
    return 1
  }
  return iter
}
