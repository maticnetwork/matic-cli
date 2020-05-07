import Listr from 'listr'
import chalk from 'chalk'
import path from 'path'
import execa from 'execa'
import fs from 'fs-extra'
import { projectInstall } from 'pkg-install'

import { printDependencyInstructions } from '../helper'
import { loadConfig } from '../config'
import { cloneRepository } from '../../lib/utils'

export class Contracts {
  constructor(config, options = {}) {
    this.config = config

    this.repositoryName = 'contracts'
    this.repositoryBranch = options.repositoryBranch || 'master'
    this.repositoryUrl = options.repositoryUrl || 'https://github.com/maticnetwork/contracts'
  }

  get name() {
    return this.repositoryName
  }

  get taskTitle() {
    return 'Setup contracts'
  }

  get repositoryDir() {
    return path.join(this.config.codeDir, this.repositoryName)
  }

  get localContractAddressesPath() {
    return path.join(this.repositoryDir, 'contractAddresses.json')
  }

  get contractAddressesPath() {
    return path.join(this.config.configDir, 'contractAddresses.json')
  }

  get contractAddresses() {
    return require(this.contractAddressesPath)
  }

  cloneRepositoryTasks() {
    return [
      {
        title: 'Clone matic contracts repository',
        task: () => cloneRepository(this.repositoryName, this.repositoryBranch, this.repositoryUrl, this.config.codeDir)
      }
    ]
  }

  compileTasks() {
    return [
      {
        title: 'Install dependencies for matic contracts',
        task: () => projectInstall({
          cwd: this.repositoryDir
        })
      },
      {
        title: 'Process templates',
        task: () => execa('node', ['scripts/process-templates.js', '--bor-chain-id', this.config.borChainId], {
          cwd: this.repositoryDir
        })
      },
      {
        title: 'Compile matic contracts',
        task: () => execa('npm', ['run', 'truffle:compile'], {
          cwd: this.repositoryDir
        })
      }
    ]
  }

  prepareContractAddressesTasks() {
    return [
      {
        title: 'Prepare contract addresses',
        task: async () => {
          // copy local contract address json file to config folder
          if (fs.existsSync(this.localContractAddressesPath)) {
            await execa('cp', [this.localContractAddressesPath, this.contractAddressesPath])
          }
        }
      },
      {
        title: 'Load contract addresses',
        task: () => {
          this.config.contractAddresses = this.contractAddresses
        }
      }
    ]
  }

  async getTasks() {
    return new Listr(
      [
        ...this.cloneRepositoryTasks(),
        ...this.compileTasks(),
        ...this.prepareContractAddressesTasks() // prepare contract addresses and load in config
      ],
      {
        exitOnError: true
      }
    )
  }
}

async function setupContracts(config) {
  const contracts = new Contracts(config)

  // get contracts tasks and run them
  const tasks = await contracts.getTasks()
  await tasks.run()

  console.log('%s Contracts are deployed', chalk.green.bold('DONE'))
}

export default async function () {
  await printDependencyInstructions()

  // configuration
  const config = await loadConfig()
  await config.loadChainIds()

  // start contracts
  await setupContracts(config)
}
