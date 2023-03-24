import { start } from './express/commands/start'
import { updateAll, updateBor, updateHeimdall } from './express/commands/update'
import { terraformInit } from './express/commands/init'
import { terraformDestroy } from './express/commands/destroy'
import { startStressTest } from './express/commands/stress'
import { sendStateSyncTx } from './express/commands/send-state-sync'
import { sendStakedEvent } from './express/commands/send-staked-event'
import { sendStakeUpdateEvent } from './express/commands/send-stake-update'
import { sendSignerChangeEvent } from './express/commands/send-signer-change'
import { sendUnstakeInitEvent } from './express/commands/send-unstake-init'
import { sendTopUpFeeEvent } from './express/commands/send-topupfee'
import { monitor } from './express/commands/monitor'
import {
  restartAll,
  restartBor,
  restartHeimdall
} from './express/commands/restart'
import { cleanup } from './express/commands/cleanup'
import { setupDatadog } from './express/commands/setup-datadog'
import { chaos } from './express/commands/chaos'
import { checkDir } from './express/common/files-utils'
import { timer } from './express/common/time-utils'
import { program } from 'commander'
import pkg from '../package.json'
import { testEip1559 } from '../tests/test-eip-1559'
import { stopInstances } from './express/commands/aws-instances-stop'
import { startInstances } from './express/commands/aws-instances-start'
import { rewind } from './express/commands/rewind'
import { awsKeypairAdd } from './express/commands/aws-keypair-add'
import { awsKeypairDestroy } from './express/commands/aws-keypair-destroy'

program
  .option('-i, --init', 'Initiate the terraform setup')
  .option('-s, --start', 'Start the setup')
  .option('-d, --destroy', 'Destroy the setup')
  .option(
    '-uall, --update-all [index]',
    'Update bor and heimdall on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index'
  )
  .option(
    '-ubor, --update-bor [index]',
    'Update bor on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index'
  )
  .option(
    '-uheimdall, --update-heimdall [index]',
    'Update heimdall on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index'
  )
  .option(
    '-rall, --restart-all [index]',
    'Restart both bor and heimdall on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index'
  )
  .option(
    '-rbor, --restart-bor [index]',
    'Restart bor on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index'
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
  .option('-sstake, --send-staked-event', 'Send staked event')
  .option('-sstakeupdate, --send-stakeupdate-event', 'Send staked-update event')
  .option(
    '-ssignerchange, --send-signerchange-event',
    'Send signer-change event'
  )
  .option('-stopupfee, --send-topupfee-event', 'Send topupfee event')
  .option(
    '-sunstakeinit, --send-unstakeinit-event [validatorID]',
    'Send unstake-init event'
  )
  .option(
    '-e1559, --eip-1559-test [index]',
    'Test EIP 1559 txs. In case of a non-dockerized devnet, if an integer [index] is specified, it will use that VM to send the tx. Otherwise, it will target the first VM.'
  )
  .option('-dd, --setup-datadog', 'Setup DataDog')
  .option('-xxx, --chaos [intensity]', 'Start Chaos')
  .option('-istop, --instances-stop', 'Stop aws ec2 instances')
  .option('-istart, --instances-start', 'Start aws ec2 instances')
  .option('-rewind, --rewind [numberOfBlocks]', 'Rewind the chain by a given number of blocks')
  .option(
    '-key-a, --aws-key-add',
    'Generate additional aws keypair for the devnet'
  )
  .option('-key-d, --aws-key-des [keyName]', 'Destroy aws keypair from devnet, given its keyName')
  .version(pkg.version)

export async function cli() {
  console.log(
    '\n📍Express CLI 🚀',
    '\nUse --help to see the available commands\n'
  )

  program.parse(process.argv)
  const options = program.opts()

  if (options.init) {
    console.log('📍Command --init')
    if (!checkDir(true)) {
      console.log(
        "❌ The init command is supposed to be executed from the project root directory, named 'matic-cli'!"
      )
      process.exit(1)
    }
    await terraformInit()
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
    console.log('📍Command --send-staked-event ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await timer(3000)
    await sendStakedEvent()
  } else if (options.sendStakeupdateEvent) {
    console.log('📍Command --send-stakeupdate-event ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await timer(3000)
    await sendStakeUpdateEvent()
  } else if (options.sendSignerchangeEvent) {
    console.log('📍Command --send-signerchange-event ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await timer(3000)
    await sendSignerChangeEvent()
  } else if (options.sendUnstakeinitEvent) {
    console.log('📍Command --send-unstakeinit-event [validatorID]')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    if (options.sendUnstakeinitEvent === true) {
      if (parseInt(options.sendUnstakeinitEvent) < 1) {
        options.sendUnstakeinitEvent = 1
      }
    }
    await timer(3000)
    await sendUnstakeInitEvent(parseInt(options.sendUnstakeinitEvent))
  } else if (options.sendTopupfeeEvent) {
    console.log('📍Command --send-topupfee-event ')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await timer(3000)
    await sendTopUpFeeEvent()
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
  } else if (options.chaos) {
    console.log('📍Command --chaos [intensity]')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
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
    if (options.rewind === true) {
      options.rewind = 100
    }

    await timer(3000)
    await rewind(options.rewind)
  } else if (options.awsKeyAdd) {
    console.log('📍 Command --aws-key-add')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await awsKeypairAdd()
  } else if (options.awsKeyDes) {
    console.log('📍 Command --aws-key-des')
    if (!checkDir(false)) {
      console.log(
        '❌ The command is not called from the appropriate devnet directory!'
      )
      process.exit(1)
    }
    await awsKeypairDestroy(options.awsKeyDes)
  }
}
