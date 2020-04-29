import Listr from 'listr'
import execa from 'execa'
import chalk from 'chalk'
import inquirer from 'inquirer'
import path from 'path'
import fs from 'fs'
import { projectInstall } from 'pkg-install'
import { isValidAddress } from 'ethereumjs-util'

import { loadConfig } from '../config'
import { cloneRepository } from '../../lib/utils'
import { printDependencyInstructions } from '../helper'

// default stake and balance
const DEFAULT_STAKE = 10
const DEFAULT_BALANCE = 1000

export class Genesis {
  constructor(config) {
    this.config = config

    this.respositoryName = this.name
    this.respositoryUrl = 'https://github.com/maticnetwork/genesis-contracts'
    this.maticContractsRepository = 'matic-contracts'
    this.maticContractsRepositoryUrl = 'https://github.com/maticnetwork/contracts'
  }

  get name() {
    return 'genesis-contracts'
  }

  get taskTitle() {
    return 'Setup genesis contracts'
  }

  get repositoryDir() {
    return path.join(this.config.codeDir, this.respositoryName)
  }

  get maticContractDir() {
    return path.join(this.config.codeDir, this.respositoryName, this.maticContractsRepository)
  }

  async print() {
    console.log(chalk.gray('Bor genesis path') + ': ' + chalk.bold.green(path.join(this.repositoryDir, 'genesis.json')))
  }

  // get genesis contact tasks
  async getTasks() {
    return new Listr(
      [
        {
          title: 'Clone genesis-contracts repository',
          task: () => cloneRepository(this.respositoryName, this.respositoryUrl, this.config.codeDir)
        },
        {
          title: 'Install dependencies for genesis-contracts',
          task: () => projectInstall({
            cwd: this.repositoryDir
          })
        },
        {
          title: 'Setting up sub-modules',
          task: () => execa('git', ['submodule', 'init'], {
            cwd: this.repositoryDir
          })
        },
        {
          title: 'Update sub-modules',
          task: () => execa('git', ['submodule', 'update'], {
            cwd: this.repositoryDir
          })
        },
        {
          title: 'Install dependencies for matic-contracts',
          task: () => projectInstall({
            cwd: this.maticContractDir
          })
        },
        {
          title: 'Process templates',
          task: () => execa('node', ['scripts/process-templates.js', '--bor-chain-id', this.config.borChainId], {
            cwd: this.maticContractDir
          })
        },
        {
          title: 'Compile matic-contracts',
          task: () => execa('npm', ['run', 'truffle:compile'], {
            cwd: this.maticContractDir
          })
        },
        {
          title: 'Prepare validators for genesis file',
          task: () => {
            const validators = this.config.genesisAddresses.map(a => {
              return {
                address: a,
                stake: DEFAULT_STAKE, // without 10^18
                balance: DEFAULT_BALANCE // without 10^18
              }
            })

            return Promise.resolve().then(() => {
              // check if validators js exists
              const validatorJsPath = path.join(this.repositoryDir, 'validators.js')
              if (!fs.existsSync(validatorJsPath)) {
                return
              }

              // take validator js backup
              return execa('mv', ['validators.js', 'validators.js.backup'], {
                cwd: this.repositoryDir
              })
            }).then(() => {
              fs.writeFileSync(path.join(this.repositoryDir, 'validators.json'), JSON.stringify(validators, null, 2), 'utf8')
            })
          }
        },
        {
          title: 'Generate Bor validator set',
          task: () => execa('node', [
            'generate-borvalidatorset.js', '--bor-chain-id', this.config.borChainId, '--heimdall-chain-id', this.config.heimdallChainId
          ], {
            cwd: this.repositoryDir
          })
        },
        {
          title: 'Generate genesis.json',
          task: () => execa('node', [
            'generate-genesis.js', '--bor-chain-id', this.config.borChainId, '--heimdall-chain-id', this.config.heimdallChainId
          ], {
            cwd: this.repositoryDir
          })
        }
      ],
      {
        exitOnError: true
      }
    )
  }
}

export async function getGenesisAddresses() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'genesisAddresses',
      message: 'Please enter comma separated validator addresses',
      default: '0x6c468CF8c9879006E22EC4029696E005C2319C9D',
      validate: (input) => {
        const addrs = input.split(',').map(a => {
          return a.trim().toLowerCase()
        }).filter(a => {
          return isValidAddress(a)
        })

        // check if addrs has any valid address
        if (addrs.length === 0) {
          return 'Enter valid addresses (comma separated)'
        }

        return true
      }
    }
  ])

  // set genesis addresses
  return answers.genesisAddresses.split(',').map(a => {
    return a.trim().toLowerCase()
  })
}

async function setupGenesis(config) {
  const genesis = new Genesis(config)

  // load genesis addresses
  config.genesisAddresses = await getGenesisAddresses()

  // get all genesis related tasks
  const tasks = await genesis.getTasks()

  // run all tasks
  await tasks.run()
  console.log('%s Genesis file is ready', chalk.green.bold('DONE'))

  // print genesis path
  await genesis.print()

  return true
}

export default async function () {
  await printDependencyInstructions()

  // configuration
  const config = await loadConfig()
  await config.loadChainIds()
  // await config.loadAccount() // no account load needed

  // start setup
  await setupGenesis(config)
}
