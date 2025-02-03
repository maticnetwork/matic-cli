// noinspection JSUnresolvedFunction

import shell from 'shelljs'
import dotenv from 'dotenv'

export async function startRpcTest() {
  dotenv.config({ path: `${process.cwd()}/.env` })

  shell.pushd('../../tests/rpc-tests')
  shell.exec('go mod tidy')

  shell.exec(
    `go run main.go --rpc-url "${process.env.RPC_URL}" --mnemonic "${process.env.MNEMONIC}" `
  )

  shell.popd()
}
