import Listr from 'listr'
import inquirer from 'inquirer'
import chalk from 'chalk'
import path from 'path'
import execa from 'execa'
import fs from 'fs-extra'
import { projectInstall } from 'pkg-install'

import { printDependencyInstructions, getDefaultBranch } from '../helper'
import { loadConfig } from '../config'
import { cloneRepository, processTemplateFiles } from '../../lib/utils'

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

  print() { }

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
        task: () => execa('npm', ['run', 'template:process', '--', '--bor-chain-id', this.config.borChainId], {
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

  async getRootDeploymentTasks() {
    return new Listr(
      [
        // ...this.cloneRepositoryTasks(),
        // ...this.compileTasks(),
        {
          title: 'Process scripts',
          task: async () => {
            const templateDir = path.resolve(
              new URL(import.meta.url).pathname,
              '../templates'
            );

            // copy all templates to target directory
            await fs.copy(templateDir, this.config.targetDirectory)

            // process all njk templates
            await processTemplateFiles(this.config.targetDirectory, { obj: this })

            // move contracts root deploy sh file
            await execa('mv', [
              path.join(this.config.targetDirectory, 'deploy-worker.js'),
              path.join(this.repositoryDir, 'deploy-worker.js')
            ])
          }
        },
        {
          title: 'Deploy root contracts',
          task: async () => {
            const obj = await execa('bash', [path.join(this.config.targetDirectory, 'contracts-root-deploy.sh')], {
              cwd: this.repositoryDir,
            })
            console.log(obj)
            return obj
          }
        },
        ...this.prepareContractAddressesTasks() // prepare contract addresses and load in config
      ],
      {
        exitOnError: true
      }
    )
  }

  async getTasks() { }
}

async function setupContracts(config) {
  const contracts = new Contracts(config)

  // get contracts tasks and run them
  let tasks = []
  if (config.contractsAction === 'root-deploy') {
    tasks = await contracts.getRootDeploymentTasks()
  }
  await tasks.run()

  console.log('%s', chalk.green.bold('DONE'))
}

export default async function () {
  await printDependencyInstructions()

  // configuration
  const config = await loadConfig()
  await config.loadChainIds()
  // force ask for account when loading
  await config.forceAskAccount()
  await config.loadAccount()

  // load branch
  let answers = await getDefaultBranch(config)
  config.set(answers)

  const questions = [
    {
      type: 'input',
      name: 'ethURL',
      message: 'Please enter ETH url for deploy',
      default: 'http://localhost:9545'
    },
    {
      type: 'input',
      name: 'borURL',
      message: 'Please enter BOR url for deploy',
      default: 'http://localhost:8545'
    },
    {
      type: 'list',
      name: 'contractsAction',
      message: 'Please select an action to perform',
      choices: [
        { name: 'Rootchain deployment', value: 'root-deploy' },
        { name: 'Stake', value: 'root-stake' },
        { name: 'Borchain deployment', value: 'bor-deploy' },
        { name: 'Sync Bor state to root', value: 'bor-state-sync' }
      ]
    }
  ]

  answers = await inquirer.prompt(questions)
  config.set(answers)

  // start contracts
  await setupContracts(config)
}
