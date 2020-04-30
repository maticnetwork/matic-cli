import Listr from 'listr';
import chalk from 'chalk';
import path from 'path';
import execa from 'execa';
import fs from 'fs-extra';
import ganacheCli from 'ganache-cli';
import { projectInstall } from 'pkg-install';

import fileReplacer from '../../lib/file-replacer'
import { loadConfig } from '../config'
import { cloneRepository } from '../../lib/utils'
import { printDependencyInstructions } from '../helper'

export class Ganache {
  constructor(config) {
    this.config = config

    this.dbName = 'ganache-db'
    this.serverPort = 9545
    this.maticContractsRepository = 'matic-contracts'
    this.maticContractsRepositoryUrl = 'https://github.com/maticnetwork/contracts'
  }

  get name() {
    return 'ganache'
  }

  get taskTitle() {
    return 'Setup contracts'
  }

  get dbDir() {
    return path.join(this.config.dataDir, this.dbName)
  }

  get maticContractDir() {
    return path.join(this.config.codeDir, this.maticContractsRepository)
  }

  get contractAddressesPath() {
    return path.join(this.config.codeDir, this.maticContractsRepository, 'contractAddresses.json')
  }

  async print() {
    console.log(chalk.gray('Ganache db path') + ': ' + chalk.bold.green(this.dbDir))
  }

  async getStakeTasks() {
    // stake
    return new Listr([
      {
        title: 'Stake',
        task: () => execa('bash', ['ganache-stake.sh', this.config.address, this.config.publicKey, this.config.defaultStake], {
          cwd: this.config.targetDirectory,
        })
      }
    ], {
      exitOnError: true,
    })
  }

  async getContractDeploymenTasks() {
    // server
    let server = null

    return new Listr([
      {
        title: 'Reset ganache',
        task: () => {
          return fs.remove(this.dbDir)
        }
      },
      {
        title: 'Start ganache',
        task: () => {
          server = ganacheCli.server({
            accounts: [{
              balance: '0xfffffffffffffffffffffffffffffffffffffffffffff',
              secretKey: this.config.privateKey
            }],
            port: this.serverPort,
            db_path: this.dbDir,
            gasPrice: '0x1',
            gasLimit: '0xfffffffff',
          });

          return new Promise((resolve, reject) => {
            server.listen(this.serverPort, (err, blockchain) => {
              if (err) {
                reject(err)
              } else {
                resolve(blockchain)
              }
            })
          })
        }
      },
      {
        title: 'Deploy contracts',
        task: () => execa('bash', ['ganache-deployment.sh', this.config.privateKey, this.config.heimdallChainId], {
          cwd: this.config.targetDirectory,
        })
      },
      {
        title: 'Setup validators',
        task: () => {
          return this.getStakeTasks()
        }
      },
      {
        title: 'Stop ganache',
        task: () => {
          if (!server) {
            return
          }

          return new Promise((resolve, reject) => {
            server.close((err) => {
              if (err) {
                reject(err)
              } else {
                resolve()
              }
            })
          })
        }
      },
      {
        title: 'Load contract addresses',
        task: () => {
          this.config.contractAddresses = require(this.contractAddressesPath)
        }
      }
    ], {
      exitOnError: true,
    })
  }

  async getTasks() {
    return new Listr(
      [
        {
          title: 'Clone matic contracts repository',
          task: () => cloneRepository(this.maticContractsRepository, this.maticContractsRepositoryUrl, this.config.codeDir)
        },
        {
          title: 'Install dependencies for matic contracts',
          task: () => projectInstall({
            cwd: this.maticContractDir,
          })
        },
        {
          title: 'Process templates',
          task: () => execa('node', ['scripts/process-templates.js', '--bor-chain-id', this.config.borChainId], {
            cwd: this.maticContractDir,
          })
        },
        {
          title: 'Compile matic contracts',
          task: () => execa('npm', ['run', 'truffle:compile'], {
            cwd: this.maticContractDir,
          })
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
        },
        {
          title: 'Process template scripts',
          task: () => {
            const startScriptFile = path.join(this.config.targetDirectory, 'ganache-start.sh')
            const deploymentScriptFile = path.join(this.config.targetDirectory, 'ganache-deployment.sh')
            const ganacheStakeFile = path.join(this.config.targetDirectory, 'ganache-stake.sh')

            fileReplacer(startScriptFile).
              replace(/PRIVATE_KEY=.+/gi, `PRIVATE_KEY=${this.config.privateKey}`).
              replace(/STAKE=.+/gi, `STAKE=${this.config.defaultStake}`).
              save()

            fileReplacer(deploymentScriptFile).
              replace(/PRIVATE_KEY=.+/gi, `PRIVATE_KEY=${this.config.privateKey}`).
              replace(/HEIMDALL_ID=.+/gi, `HEIMDALL_ID=${this.config.heimdallChainId}`).
              save()

            fileReplacer(ganacheStakeFile).
              replace(/ADDRESS=.+/gi, `ADDRESS=${this.config.address}`).
              replace(/PUB_KEY=.+/gi, `PUB_KEY=${this.config.publicKey}`).
              save()
          }
        },
        {
          title: 'Deploy contracts',
          task: () => this.getContractDeploymenTasks() // get contact deployment tasks
        }
      ],
      {
        exitOnError: true,
      }
    );
  }
}

async function setupGanache(config) {
  const ganache = new Ganache(config)

  // get ganache tasks
  const tasks = await ganache.getTasks();

  await tasks.run();
  console.log('%s Ganache snapshot is ready', chalk.green.bold('DONE'));

  // print details
  await config.print()
  await ganache.print()
}

export default async function () {
  await printDependencyInstructions()

  // configuration
  const config = await loadConfig()
  await config.loadChainIds()
  await config.loadAccount()

  // start ganache
  await setupGanache(config)
}