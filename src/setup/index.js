import { Command } from 'commander'

import heimdall from './heimdall/index.js'
import genesis from './genesis/index.js'
import bor from './bor/index.js'
import localnet from './localnet/index.js'
import anvil from './anvil/index.js'
import devnet from './devnet/index.js'

//
// Add sub commands
//
const heimdallCmd = new Command('heimdall')
heimdallCmd.action(heimdall)

const genesisCmd = new Command('genesis')
genesisCmd.action(genesis)

const borCmd = new Command('bor')
borCmd.action(bor)

const anvilCmd = new Command('anvil')
anvilCmd.action(anvil)

const localnetCmd = new Command('localnet')
localnetCmd.action(localnet)

const devnetCmd = new Command('devnet')
devnetCmd.action(devnet)

export default [
  heimdallCmd,
  genesisCmd,
  borCmd,
  anvilCmd,
  localnetCmd,
  devnetCmd
]
