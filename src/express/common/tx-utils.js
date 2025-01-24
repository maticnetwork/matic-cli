export async function getSignedTx(
  web3object,
  to,
  tx,
  validatorAccount,
  privateKey
) {
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
