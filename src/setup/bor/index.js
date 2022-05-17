import Listr from 'listr'
import execa from 'execa'
import chalk from 'chalk'
import path from 'path'
import fs from 'fs-extra'

import { loadConfig } from '../config'
import { cloneRepository, getKeystoreFile, processTemplateFiles } from '../../lib/utils'
import { printDependencyInstructions, getDefaultBranch } from '../helper'
import { Genesis } from '../genesis'

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

    this.genesis = new Genesis(config)
  }

  get name() {
    return 'bor'
  }

  get taskTitle() {
    return 'Setup Bor'
  }

  get repositoryDir() {
    return path.join(this.config.codeDir, this.repositoryName)
  }

  get buildDir() {
    return path.join(this.repositoryDir, 'build')
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
    console.log(chalk.gray('Setup bor chain') + ': ' + chalk.bold.green('bash bor-setup.sh'))
    console.log(chalk.gray('Start bor chain') + ': ' + chalk.bold.green('bash bor-start.sh'))
    console.log(chalk.gray('Clean bor chain') + ': ' + chalk.bold.green('bash bor-clean.sh'))
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
          task: () => execa('make', ['bor-all'], {
            cwd: this.repositoryDir
          })
        },
        {
          title: 'Prepare data directory',
          task: () => {
            return execa('mkdir', ['-p', this.config.dataDir, this.borDataDir, this.keystoreDir], {
              cwd: this.config.targetDirectory
            })
          }
        },
        {
          title: 'Prepare keystore and password.txt',
          task: () => {
            if(this.config.devnetType === 'remote') {
              return
            }
            // get keystore file and store in keystore file
            const keystoreFileObj = getKeystoreFile(this.config.primaryAccount.privateKey, this.config.keystorePassword)

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
          title: 'Process template scripts',
          task: async () => {
            if(this.config.devnetType === 'remote') {
              return
            }
            const templateDir = path.resolve(
              new URL(import.meta.url).pathname,
              '../templates'
            )

            // copy all templates to target directory
            await fs.copy(templateDir, this.config.targetDirectory)

            // process all njk templates
            await processTemplateFiles(this.config.targetDirectory, { obj: this })
          }
        }
      ],
      {
        exitOnError: true
      }
    )
  }
}

async function setupBor(config) {
  const bor = new Bor(config)

  const tasks = new Listr(
    [
      {
        title: bor.genesis.taskTitle,
        task: () => {
          return bor.genesis.getTasks()
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
  console.log('%s Bor is ready', chalk.green.bold('DONE'))

  // print config
  await config.print()
  await bor.genesis.print(config)
  await bor.print()

  return true
}

export default async function () {
  await printDependencyInstructions()

  // configuration
  const config = await loadConfig({ targetDirectory: process.cwd() })
  await config.loadChainIds()
  await config.loadAccounts()

  // load branch
  const answers = await getDefaultBranch(config)
  config.set(answers)

  // start setup
  await setupBor(config)
}
