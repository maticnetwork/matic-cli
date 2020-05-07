import { Command } from 'commander'

import heimdall from './heimdall'
import genesis from './genesis'
import bor from './bor'
import localnet from './localnet'
import ganache from './ganache'
import devnet from './devnet'
import contracts from './contracts'

//
// Add sub commands
//
const heimdallCmd = new Command('heimdall')
heimdallCmd.action(heimdall)

const genesisCmd = new Command('genesis')
genesisCmd.action(genesis)

const borCmd = new Command('bor')
borCmd.action(bor)

const ganacheCmd = new Command('ganache')
ganacheCmd.action(ganache)

const localnetCmd = new Command('localnet')
localnetCmd.action(localnet)

const devnetCmd = new Command('devnet')
devnetCmd.action(devnet)

const contractsCmd = new Command('contracts')
contractsCmd.action(contracts)

export default [heimdallCmd, genesisCmd, borCmd, ganacheCmd, localnetCmd, devnetCmd, contractsCmd]
