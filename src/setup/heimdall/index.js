import Listr from 'listr'
import execa from 'execa'
import chalk from 'chalk'
import path from 'path'
import fs from 'fs-extra'
import os from 'os'

import fileReplacer from '../../lib/file-replacer'
import { loadConfig } from '../config'
import { cloneRepository } from '../../lib/utils'
import { printDependencyInstructions } from '../helper'
import { Ganache } from '../ganache'

// repository name
export const REPOSITORY_NAME = 'heimdall'
export const HEIMDALL_HOME = '.heimdalld'

export function getValidatorKeyPath() {
  return path.join(os.homedir(), HEIMDALL_HOME, 'config/priv_validator_key.json')
}

export class Heimdall {
  constructor(config) {
    this.config = config

    this.respositoryName = this.name
    this.respositoryUrl = 'https://github.com/maticnetwork/heimdall'
  }

  get name() {
    return 'heimdall'
  }

  get taskTitle() {
    return 'Setup heimdall'
  }

  get validatorKeyFile() {
    return 'priv_validator_key.json'
  }

  get validatorKeyFilePath() {
    return path.join(this.config.configDir, this.validatorKeyFile)
  }

  get repositoryDir() {
    return path.join(this.config.codeDir, this.respositoryName)
  }

  get buildDir() {
    return path.join(this.config.codeDir, this.respositoryName, 'build')
  }

  get heimdallDataDir() {
    return path.join(this.config.dataDir, this.name)
  }

  get heimdallGenesisFilePath() {
    return path.join(this.heimdallDataDir, 'config/genesis.json')
  }

  get heimdalldCmd() {
    return path.join(this.repositoryDir, 'build/heimdalld')
  }

  get heimdallcliCmd() {
    return path.join(this.repositoryDir, 'build/heimdallcli')
  }

  async print() {
    // print details
    console.log(chalk.gray('Heimdall home') + ': ' + chalk.bold.green(this.heimdallDataDir))
    console.log(chalk.gray('Heimdall genesis') + ': ' + chalk.bold.green(this.heimdallGenesisFilePath))
    console.log(chalk.gray('Heimdall validator key') + ': ' + chalk.bold.green(this.validatorKeyFilePath))
    console.log(chalk.gray('Heimdall repo') + ': ' + chalk.bold.green(this.repositoryDir))
    console.log(chalk.gray('Setup heimdall') + ': ' + chalk.bold.green("bash heimdall-start.sh"))
    console.log(chalk.gray('Start heimdall rest-server') + ': ' + chalk.bold.green("bash heimdall-server-start.sh"))
    console.log(chalk.gray('Start heimdall bridge') + ': ' + chalk.bold.green("bash heimdall-bridge-start.sh"))
    console.log(chalk.gray('Reset heimdall') + ': ' + chalk.bold.green("bash heimdall-clean.sh"))
  }

  async account() {
    return execa(this.heimdalldCmd, ['show-account', '--home', this.heimdallDataDir], {
      cwd: this.config.targetDirectory
    }).then(output => {
      return JSON.parse(output.stdout)
    })
  }

  // returns heimdall private key details
  async accountPrivateKey() {
    return execa(this.heimdalldCmd, ['show-privatekey', '--home', this.heimdallDataDir], {
      cwd: this.config.targetDirectory
    }).then(output => {
      return JSON.parse(output.stdout).priv_key
    })
  }

  // returns content of validator key
  async generateValidatorKey() {
    return execa(this.heimdallcliCmd, ['generate-validatorkey', this.config.privateKey, '--home', this.heimdallDataDir], {
      cwd: this.config.configDir
    }).then(() => {
      return require(this.validatorKeyFilePath)
    })
  }

  async getProcessGenesisFileTasks() {
    return new Listr([
      {
        title: 'Process Heimdall and Bor chain ids',
        task: () => {
          fileReplacer(this.heimdallGenesisFilePath).
            replace(/"chain_id":[ ]+".*"/gi, `"chain_id": "${this.config.heimdallChainId}"`).
            replace(/"bor_chain_id":[ ]+".*"/gi, `"bor_chain_id": "${this.config.borChainId}"`).
            save()
        }
      },
      {
        title: 'Process contract addresses',
        task: () => {
          // get root contracts
          const rootContracts = this.config.contractAddresses.root

          fileReplacer(this.heimdallGenesisFilePath).
            replace(/"matic_token_address":[ ]+".*"/gi, `"matic_token_address": "${rootContracts.tokens.TestToken}"`).
            replace(/"staking_manager_address":[ ]+".*"/gi, `"staking_manager_address": "${rootContracts.StakeManagerProxy}"`).
            replace(/"root_chain_address":[ ]+".*"/gi, `"root_chain_address": "${rootContracts.RootChainProxy}"`).
            replace(/"staking_info_address":[ ]+".*"/gi, `"staking_info_address": "${rootContracts.StakingInfo}"`).
            replace(/"state_sender_address":[ ]+".*"/gi, `"state_sender_address": "${rootContracts.StateSender}"`).
            save()
        },
        enabled: () => {
          return this.config.contractAddresses
        }
      }
    ], {
      exitOnError: true
    })
  }

  async getTasks() {
    return new Listr(
      [
        {
          title: 'Clone Heimdall repository',
          task: () => cloneRepository(this.respositoryName, this.respositoryUrl, this.config.codeDir)
        },
        {
          title: 'Build Heimdall',
          task: () => execa('make', ['build'], {
            cwd: this.repositoryDir
          })
        },
        {
          title: 'Init Heimdall',
          task: () => {
            return execa(this.heimdalldCmd, ['init', '--home', this.heimdallDataDir], {
              cwd: this.repositoryDir
            })
          }
        },
        {
          title: 'Create Heimdall account from private key',
          task: () => {
            return this.generateValidatorKey().then(data => {
              return fs.writeFile(this.validatorKeyFilePath, JSON.stringify(data, null, 2), { mode: 0o755 })
            })
          }
        },
        {
          title: 'Process genesis file',
          task: () => {
            return this.getProcessGenesisFileTasks()
          }
        },
        {
          title: 'Copy template scripts',
          task: () => {
            const templateDir = path.resolve(
              new URL(import.meta.url).pathname,
              '../templates'
            );

            return fs.copy(templateDir, this.config.targetDirectory)
          }
        }
      ],
      {
        exitOnError: true
      }
    )
  }
}

async function setupHeimdall(config) {
  const ganache = new Ganache(config)
  const heimdall = new Heimdall(config)

  // get all heimdall related tasks
  const tasks = new Listr([
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
    }
  ], {
    exitOnError: true
  })

  await tasks.run()
  console.log('%s Heimdall is ready', chalk.green.bold('DONE'))

  // print details
  await config.print()
  await ganache.print()
  await heimdall.print()

  return true
}

export default async function () {
  await printDependencyInstructions()

  // configuration
  const config = await loadConfig()
  await config.loadChainIds()
  await config.loadAccount()

  // start setup
  await setupHeimdall(config)
}
