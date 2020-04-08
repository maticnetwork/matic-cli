import { Command } from 'commander';

import heimdall from './heimdall'
import genesis from './genesis'
import bor from './bor'
import localnet from './localnet'


//
// Add sub commands
//
const heimdallCmd = new Command("heimdall");
heimdallCmd.action(heimdall)

const genesisCmd = new Command("genesis");
genesisCmd.action(genesis)

const borCmd = new Command("bor");
borCmd.action(bor)

const localnetCmd = new Command("localnet");
localnetCmd.action(localnet)


export default [heimdallCmd, genesisCmd, borCmd, localnetCmd]