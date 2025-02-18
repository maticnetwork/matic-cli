import { start } from './express/commands/start.js'
import {
  updateAll,
  updateBor,
  updateErigon,
  updateHeimdall
} from './express/commands/update.js'
import { terraformInit } from './express/commands/init.js'
import { terraformDestroy } from './express/commands/destroy.js'
import { startStressTest } from './express/commands/stress.js'
import { startRpcTest } from './express/commands/rpc.js'
import { sendStateSyncTx } from './express/commands/send-state-sync.js'
import { sendStakedEvent } from './express/commands/send-staked-event.js'
import { sendStakeUpdateEvent } from './express/commands/send-stake-update.js'
import { sendSignerChangeEvent } from './express/commands/send-signer-change.js'
import { sendUnstakeInitEvent } from './express/commands/send-unstake-init.js'
import { sendTopUpFeeEvent } from './express/commands/send-topupfee.js'
import { monitor } from './express/commands/monitor.js'
import {
  restartAll,
  restartBor,
  restartErigon,
  restartHeimdall
} from './express/commands/restart.js'
import { cleanup } from './express/commands/cleanup.js'
import { setupDatadog } from './express/commands/setup-datadog.js'
import { setupEthstats } from './express/commands/setup-ethstats-backend.js'
import { chaos } from './express/commands/chaos.js'
import { checkDir } from './express/common/files-utils.js'
import { timer } from './express/common/time-utils.js'
import { program } from 'commander'
import { testEip1559 } from '../tests/test-eip-1559.js'
import { stopInstances } from './express/commands/cloud-instances-stop.js'
import { startInstances } from './express/commands/cloud-instances-start.js'
import { rewind } from './express/commands/rewind.js'
import { startReorg } from './express/commands/reorg-start.js'
import { stopReorg } from './express/commands/reorg-stop.js'
import { milestoneBase } from './express/commands/milestone-base.js'
import { milestonePartition } from './express/commands/milestone-partition.js'
import { shadow } from './express/commands/shadow.js'
import { relay } from './express/commands/relay.js'
import { keypairAdd } from './express/commands/keypair-add.js'
import { keypairDestroy } from './express/commands/keypair-destroy.js'
import { constants } from './express/common/constants.js'

import pkg from '../package.json' assert { type: 'json' }
import { fundAnvilAccounts } from './express/common/anvil-utils.js'

function checkCloudProvider(provider, _) {
  const supportedClouds = [constants.cloud.AWS, constants.cloud.GCP]
  if (supportedClouds.includes(provider.toLowerCase())) {
    return provider.toLowerCase()
  }
  console.log('❌Invalid cloud provider. Choose from: ' + supportedClouds)
  process.exit(1)
}

program
  .option(
    '-i, --init <gcp|aws>',
    'Initiate the terraform setup to specified cloud',
    checkCloudProvider
  )
  .option('-s, --start', 'Start the setup')
  .option('-d, --destroy', 'Destroy the setup')
  .option(
    '-uall, --update-all [index]',
    'Update bor/erigon and heimdall on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index'
  )
  .option(
    '-ubor, --update-bor [index]',
    'Update bor on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index'
  )
  .option(
    '-uerigon, --update-erigon [index]',
    'Update erigon on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index'
  )
  .option(
    '-uheimdall, --update-heimdall [index]',
    'Update heimdall on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index'
  )
  .option(
    '-rall, --restart-all [index]',
    'Restart both bor/erigon and heimdall on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index'
  )
  .option(
    '-rbor, --restart-bor [index]',
    'Restart bor on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index'
  )
  .option(
    '-rerigon, --restart-erigon [index]',
    'Restart erigon on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index'
  )
  .option(
    '-rheimdall, --restart-heimdall [index]',
    'Restart heimdall on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index'
  )
  .option('-c, --cleanup', 'Cleanup the setup')
  .option(
    '-m, --monitor [exit]',
    'Monitor the setup. If `exit` string is passed, the process terminates when at least one stateSync and one checkpoint are detected'
  )
  .option(
    '-t, --stress [fund]',
    'Start the stress test. If the string `fund` is specified, the account will be funded. This option is mandatory when the command is executed the first time on a devnet.'
  )
  .option('-ss, --send-state-sync', 'Send state sync tx')
  .option('-sstake, --send-staked-event [validatorID]', 'Send staked event')
  .option(
    '-sstakeupdate, --send-stakeupdate-event [validatorID]',
    'Send staked-update event'
  )
  .option(
    '-ssignerchange, --send-signerchange-event [validatorID]',
    'Send signer-change event'
  )
  .option(
    '-stopupfee, --send-topupfee-event [validatorID]',
    'Send topupfee event'
  )
  .option(
    '-sunstakeinit, --send-unstakeinit-event [validatorID]',
    'Send unstake-init event'
  )
  .option(
    '-e1559, --eip-1559-test [index]',
    'Test EIP 1559 txs. In case of a non-dockerized devnet, if an integer [index] is specified, it will use that VM to send the tx. Otherwise, it will target the first VM.'
  )
  .option('-dd, --setup-datadog', 'Setup DataDog')
  .option('-ethstats, --setup-ethstats', 'Setup Ethstats')
  .option('-xxx, --chaos [intensity]', 'Start Chaos')
  .option('-istop, --instances-stop', 'Stop aws ec2 instances')
  .option('-istart, --instances-start', 'Start aws ec2 instances')
  .option('-rewind, --rewind [numberOfBlocks]', 'Rewind the chain')
  .option(
    '-reorg-start, --reorg-start [split]',
    'Reorg the chain by creating two clusters in the network, where [split] param represents the number of nodes that one of the clusters will have (with other being [total number of nodes - split])'
  )
  .option(
    '-reorg-stop, --reorg-stop',
    'Stops the reorg previously created by reconnecting all the nodes'
  )
  .option('-milestone-base, --milestone-base', 'Run milestone base tests')
  .option(
    '-milestone-partition, --milestone-partition',
    'Run milestone partition tests'
  )
  .option(
    '-rewind, --rewind [numberOfBlocks]',
    'Rewind the chain by a given number of blocks'
  )
  .option(
    '-key-a, --ssh-key-add',
    'Generate additional ssh keypair for the devnet'
  )
  .option(
    '-key-d, --ssh-key-des [keyName]',
    'Destroy ssh keypair from devnet, given its keyName'
  )
  .option(
    '-sf, --shadow-fork [blockNumber]',
    'Run nodes in shadow mode. Please note that there might be an offset of ~3-4 blocks from [blockNumber] specified when restarting the (shadow) node'
  )
  .option('-relay, --relay', 'Relay transaction to shadow node')
  .option('-rpc, --rpc-test', 'Run the rpc test command')
  .option('-fga, --fund-anvil-accounts', 'Add funds to anvil accounts')
  .version(pkg.version)

export async function cli() {
  console.log(
    '\n📍Express CLI 🚀',
    '\nUse --help to see the available commands\n'
  )

  program.parse(process.argv)
  const options = program.opts()
  if (options.init) {
    console.log('📍Command --init ' + options.init)
    if (!checkDir(true)) {
      console.log(
        "❌ The init command is supposed to be executed from the project root directory, named 'matic-cli'!"
      )
      process.exit(1)
    }
    await terraformInit(options.init)
  } else if (options.start) {
    console.log('📍Command --start')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ If you are targeting an already existing devnet, this command will only work if all bor ipc sessions have been manually closed...'
    )
    await timer(3000)
    await start()
  } else if (options.destroy) {
    console.log('📍Command --destroy ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await terraformDestroy()
  } else if (options.updateAll) {
    console.log('📍Command --update-all [index] ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...'
    )
    console.log(
      '⛔ This will only work if all bor ipc sessions have been manually closed...'
    )
    await timer(3000)
    await updateAll(options.updateAll)
  } else if (options.updateBor) {
    console.log('📍Command --update-bor [index] ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...'
    )
    console.log(
      '⛔ This will only work if all bor ipc sessions have been manually closed...'
    )
    await timer(3000)
    await updateBor(options.updateBor)
  } else if (options.updateErigon) {
    console.log('📍Command --update-erigon [index] ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...'
    )
    console.log(
      '⛔ This will only work if all bor ipc sessions have been manually closed...'
    )
    await timer(3000)
    await updateErigon(options.updateErigon)
  } else if (options.updateHeimdall) {
    console.log('📍Command --update-heimdall [index] ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...'
    )
    await timer(3000)
    await updateHeimdall(options.updateHeimdall)
  } else if (options.restartAll) {
    console.log('📍Command --restart-all [index] ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...'
    )
    console.log(
      '⛔ This will only work if all bor ipc sessions have been manually closed...'
    )
    await timer(3000)
    await restartAll(options.restartAll)
  } else if (options.restartBor) {
    console.log('📍Command --restart-bor [index] ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...'
    )
    console.log(
      '⛔ This will only work if all bor ipc sessions have been manually closed...'
    )
    await timer(3000)
    await restartBor(options.restartBor)
  } else if (options.restartErigon) {
    console.log('📍Command --restart-erigon [index] ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...'
    )
    console.log(
      '⛔ This will only work if all bor ipc sessions have been manually closed...'
    )
    await timer(3000)
    await restartErigon(options.restartErigon)
  } else if (options.restartHeimdall) {
    console.log('📍Command --restart-heimdall [index] ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command is only available for non-dockerized devnets...'
    )
    await restartHeimdall(options.restartHeimdall)
  } else if (options.cleanup) {
    console.log('📍Command --cleanup ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...'
    )
    console.log(
      '⛔ This will only work if all bor ipc sessions have been manually closed...'
    )
    await timer(3000)
    await cleanup()
  } else if (options.monitor) {
    console.log('📍Command --monitor [exit]')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log('📍Note that checkpoints do not come through on erigon yet')
    await timer(3000)
    if (options.monitor === 'exit') {
      await monitor(true)
    } else {
      await monitor(false)
    }
  } else if (options.stress) {
    console.log('📍Command --stress [fund]')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...'
    )
    await timer(3000)
    if (options.stress === 'fund') {
      await startStressTest(true)
    } else {
      await startStressTest(false)
    }
  } else if (options.sendStateSync) {
    console.log('📍Command --send-state-sync ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await timer(3000)
    await sendStateSyncTx()
  } else if (options.sendStakedEvent) {
    console.log('📍Command --send-staked-event [validatorID]')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await timer(3000)
    await sendStakedEvent(options.sendStakedEvent)
  } else if (options.sendStakeupdateEvent) {
    console.log('📍Command --send-stakeupdate-event [validatorID]')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await timer(3000)
    await sendStakeUpdateEvent(options.sendStakeupdateEvent)
  } else if (options.sendSignerchangeEvent) {
    console.log('📍Command --send-signerchange-event [validatorID]')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await timer(3000)
    await sendSignerChangeEvent(options.sendSignerchangeEvent)
  } else if (options.sendUnstakeinitEvent) {
    console.log('📍Command --send-unstakeinit-event [validatorID]')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '📍Note that this command does not properly work for erigon yet'
    )
    await timer(3000)
    await sendUnstakeInitEvent(options.sendUnstakeinitEvent)
  } else if (options.sendTopupfeeEvent) {
    console.log('📍Command --send-topupfee-event [validatorID]')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await timer(3000)
    await sendTopUpFeeEvent(options.sendTopupfeeEvent)
  } else if (options.eip1559Test) {
    console.log('📍Command --eip-1559-test')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }

    await testEip1559(options.eip1559Test)
  } else if (options.setupDatadog) {
    console.log('📍Command --setup-datadog')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await timer(3000)
    await setupDatadog()
  } else if (options.setupEthstats) {
    console.log('📍Command --setup-ethstats')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }

    await timer(3000)
    await setupEthstats()
  } else if (options.chaos) {
    console.log('📍Command --chaos [intensity]')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command currently cannot be executed against an erigon node'
    )
    if (options.chaos === true) {
      options.chaos = 5
    }

    await timer(3000)
    await chaos(options.chaos)
  } else if (options.instancesStop) {
    console.log('📍Command --instances-stop')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await timer(3000)
    await stopInstances()
  } else if (options.instancesStart) {
    console.log('📍Command --instances-start')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await timer(3000)
    await startInstances()
  } else if (options.rewind) {
    console.log('📍Command --rewind')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command currently cannot be executed against an erigon node'
    )
    if (options.rewind === true) {
      options.rewind = 100
    }

    await timer(3000)
    await rewind(options.rewind)
  } else if (options.sshKeyAdd) {
    console.log('📍 Command --ssh-key-add')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }

    await keypairAdd()
  } else if (options.sshKeyDes) {
    console.log('📍 Command --ssh-key-des')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }

    await keypairDestroy(options.sshKeyDes)
  } else if (options.reorgStart) {
    console.log('📍Command --reorg-start [split]')

    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }

    console.log(
      '⛔ This command currently cannot be executed against an erigon node'
    )
    await startReorg(options.reorg)
  } else if (options.reorgStop) {
    console.log('📍Command --reorg-stop')

    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }

    console.log(
      '⛔ This command currently cannot be executed against an erigon node'
    )
    await stopReorg()
  } else if (options.milestoneBase) {
    console.log('📍Command --milestone-base')

    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }

    console.log(
      '⛔ This command currently cannot be executed against an erigon node'
    )
    await milestoneBase()
  } else if (options.milestonePartition) {
    console.log('📍Command --milestone-partition')

    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }

    console.log(
      '⛔ This command currently cannot be executed against an erigon node'
    )
    await milestonePartition()
  } else if (options.shadowFork) {
    console.log('📍Command --shadow-fork [blockNumber]')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command currently cannot be executed against an erigon node'
    )
    console.log(
      '⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...'
    )

    await shadow(options.shadowFork)
  } else if (options.relay) {
    console.log('📍Command --relay')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command currently cannot be executed against an erigon node'
    )
    console.log(
      '⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...'
    )

    await relay()
  } else if (options.rpcTest) {
    console.log('📍Command --rpc-test')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    console.log(
      '⛔ This command currently cannot be executed against an erigon node'
    )
    console.log(
      '⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...'
    )
    await startRpcTest()
  } else if (options.fundAnvilAccounts) {
    console.log('📍Command --fund-anvil-accounts')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await fundAnvilAccounts()
  }
}
