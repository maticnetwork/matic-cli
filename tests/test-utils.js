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

export function santizeIterations(iter) {
  let iteration = iter
  if (iteration <= 0 || iteration === null || iteration === undefined) {
    iteration = 1
  }

  return iteration
}
