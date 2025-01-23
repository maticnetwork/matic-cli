export async function getSignedTx(
  web3object,
  to,
  tx,
  validatorAccount,
  privateKey
) {
  console.log("before gas")
  //const gas = await tx.estimateGas({ from: validatorAccount, gas : 500000 })
  console.log("after gas")
  const data = tx.encodeABI()
  console.log("in data")

  const signedTx = await web3object.eth.accounts.signTransaction(
    {
      from: validatorAccount,
      to,
      data,
      gas : 500000
    },
    privateKey
  )

  return signedTx
}
