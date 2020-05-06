import Listr from 'listr'
import execa from 'execa'
import chalk from 'chalk'
import path from 'path'
import fs from 'fs-extra'

import { loadConfig } from '../config'
import { cloneRepository, getKeystoreFile } from '../../lib/utils'
import { printDependencyInstructions } from '../helper'
import { Genesis } from '../genesis'
import fileReplacer from '../../lib/file-replacer'

// default password
export const KEYSTORE_PASSWORD = 'hello'

//
// Bor setup class
//

export class Bor {
  constructor(config, options = {}) {
    this.config = config

    this.repositoryName = 'bor'
    this.repositoryBranch = options.repositoryBranch || 'master'
    this.repositoryUrl = options.repositoryUrl || 'https://github.com/maticnetwork/bor'
  }

  get name() {
    return 'bor'
  }

  get taskTitle() {
    return 'Setup Bor'
  }

  async getTasks() {
    return new Listr(
      [
        {
          title: 'Clone Bor repository',
          task: () => cloneRepository(this.repositoryName, this.repositoryBranch, this.repositoryUrl, this.config.codeDir)
        },
        {
          title: 'Build Bor',
          task: () => execa('make', ['bor'], {
            cwd: this.repositoryDir,
          })
        },
        {
          title: 'Prepare data directory',
          task: () => {
            return execa('mkdir', ['-p', this.config.dataDir, this.borDataDir, this.keystoreDir], {
              cwd: this.config.targetDirectory,
            })
          }
        },
        {
          title: 'Prepare keystore and password.txt',
          task: () => {
            // get keystore file and store in keystore file
            const keystoreFileObj = getKeystoreFile(this.config.privateKey, this.config.keystorePassword)

            // resolve promise
            return fs.emptyDir(this.keystoreDir).then(() => {
              const p = [
                fs.writeFile(this.passwordFilePath, `${this.config.keystorePassword}\n`),
                fs.writeFile(path.join(this.keystoreDir, keystoreFileObj.keystoreFilename), JSON.stringify(keystoreFileObj.keystore, null, 2))
              ]
              return Promise.all(p)
            })
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
        },
        {
          title: 'Process template scripts',
          task: () => {
            const startScriptFile = path.join(this.config.targetDirectory, 'bor-start.sh')
            return fileReplacer(startScriptFile).
              replace(/ADDRESS=.+/gi, `ADDRESS=${this.config.genesisAddresses[0]}`).
              replace(/BOR_CHAIN_ID=.+/gi, `BOR_CHAIN_ID=${this.config.borChainId}`).
              save()
          }
        }
      ],
      {
        exitOnError: true,
      }
    );
  }

  get repositoryDir() {
    return path.join(this.config.codeDir, this.repositoryName)
  }

  get borDataDir() {
    return path.join(this.config.dataDir, 'bor')
  }

  get keystoreDir() {
    return path.join(this.config.dataDir, 'keystore')
  }

  get passwordFilePath() {
    return path.join(this.config.dataDir, 'password.txt')
  }

  get keystorePassword() {
    return this.config.keystorePassword || KEYSTORE_PASSWORD
  }

  async print() {
    console.log(chalk.gray('Bor data') + ': ' + chalk.bold.green(this.borDataDir))
    console.log(chalk.gray('Bor repo') + ': ' + chalk.bold.green(this.repositoryDir))
    console.log(chalk.gray('Setup bor chain') + ': ' + chalk.bold.green("bash bor-setup.sh"))
    console.log(chalk.gray('Start bor chain') + ': ' + chalk.bold.green("bash bor-start.sh"))
    console.log(chalk.gray('Clean bor chain') + ': ' + chalk.bold.green("bash bor-clean.sh"))
  }
}

async function setupBor(config) {
  const bor = new Bor(config)
  const genesis = new Genesis(config)

  const tasks = new Listr(
    [
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
      exitOnError: true,
    }
  );

  await tasks.run();
  console.log('%s Bor is ready', chalk.green.bold('DONE'));

  // print config
  await config.print()
  await genesis.print(config)
  await bor.print()

  return true;
}

export default async function () {
  await printDependencyInstructions()

  // configuration
  const config = await loadConfig({ targetDirectory: process.cwd() })
  await config.loadChainIds()
  await config.loadAccount()

  // start setup
  await setupBor(config)
}