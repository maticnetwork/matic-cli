import Listr from 'listr'
import chalk from 'chalk'

import { printDependencyInstructions, getDefaultBranch } from '../helper'
import { loadConfig } from '../config'

import { Genesis } from '../genesis'
import { Heimdall } from '../heimdall'
import { Ganache } from '../ganache'
import { Bor } from '../bor'

async function setupLocalnet(config) {
  const ganache = new Ganache(config, { repositoryBranch: config.defaultBranch })
  const bor = new Bor(config, { repositoryBranch: config.defaultBranch })
  const heimdall = new Heimdall(config, { repositoryBranch: config.defaultBranch })
  const genesis = new Genesis(config, { repositoryBranch: 'master' })

  const tasks = new Listr(
    [
      {
        title: ganache.taskTitle,
        task: () => {
          return ganache.getTasks()
        }
      },
      {
        title: heimdall.taskTitle,
        task: () => {
          return heimdall.getTasks()
        }
      },
      {
        title: genesis.taskTitle,
        task: () => {
          return genesis.getTasks()
        }
      },
      {
        title: bor.taskTitle,
        task: () => {
          return bor.getTasks()
        }
      }
    ],
    {
      exitOnError: true
    }
  )

  await tasks.run()
  console.log('%s Localnet ready', chalk.green.bold('DONE'))

  // print details
  await config.print()

  await genesis.print()
  await heimdall.print()
  await genesis.print()
  await bor.print()
}

export default async function () {
  await printDependencyInstructions()

  // configuration
  const config = await loadConfig()
  await config.loadChainIds()
  await config.loadAccount()

  // load branch
  const answers = await getDefaultBranch(config)
  config.set(answers)

  // start setup
  await setupLocalnet(config)
}
