import Listr from 'listr';
import chalk from 'chalk';
import path from 'path';
import execa from 'execa';
import fs from 'fs-extra';
import ganacheCli from 'ganache-cli';
import { projectInstall } from 'pkg-install';

import { loadConfig } from '../config'
import { cloneRepository, processTemplateFiles } from '../../lib/utils'
import { printDependencyInstructions } from '../helper'
import { Contracts } from '../contracts'

export class Ganache {
  constructor(config, options = {}) {
    this.config = config

    this.dbName = 'ganache-db'
    this.serverPort = 9545

    // get contracts setup obj
    this.contracts = new Contracts(config, { repositoryBranch: options.contractsBranch })
  }

  get name() {
    return 'ganache'
  }

  get taskTitle() {
    return 'Setup contracts on Ganache'
  }

  get dbDir() {
    return path.join(this.config.dataDir, this.dbName)
  }

  async print() {
    console.log(chalk.gray('Ganache db path') + ': ' + chalk.bold.green(this.dbDir))
  }

  async getStakeTasks() {
    // stake
    return new Listr([
      {
        title: 'Stake',
        task: () => execa('bash', ['ganache-stake.sh'], {
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
        task: () => execa('bash', ['ganache-deployment.sh'], {
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
      }
    ], {
      exitOnError: true,
    })
  }

  async getTasks() {
    return new Listr(
      [
        ...this.contracts.cloneRepositoryTasks(),
        ...this.contracts.compileTasks(),
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
          }
        },
        {
          title: 'Deploy contracts',
          task: () => this.getContractDeploymenTasks() // get contact deployment tasks
        },
        ...this.contracts.prepareContractAddressesTasks(), // prepare contract addresses and load in config
      ],
      {
        exitOnError: true,
      }
    );
  }
}

async function setupGanache(config) {
  const ganache = new Ganache(config, { contractsBranch: config.contractsBranch })

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