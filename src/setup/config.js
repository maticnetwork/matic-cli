import inquirer from 'inquirer'
import fs from 'fs-extra'
import path from 'path'
import execa from 'execa'
import chalk from 'chalk'
import { toBuffer, privateToPublic, bufferToHex } from 'ethereumjs-util'

import { getKeystoreDetails, getChainIds } from './helper'
import { getWalletFromPrivateKey } from '../utils'

const defaultConfigFileName = 'config.json'

export default class Config {
  constructor(options = {}) {
    if (!options.fileName || !options.targetDirectory) {
      throw new Error('Filename and target directory needed')
    }

    options.codeDirectory = options.codeDirectory || 'code'
    options.dataDirectory = options.dataDirectory || 'data'
    options.configDirectory = options.configDirectory || 'config'

    // assign all prop to obj
    this.set(options)
  }

  set(options = {}) {
    for (const prop in options) {
      if (options.hasOwnProperty(prop)) {
        Object.defineProperty(this, prop, {
          value: options[prop],
          writable: false,
          enumerable: true
        })
      }
    }
  }

  get configFilePath() {
    return path.join(this.targetDirectory, this.fileName)
  }

  get codeDir() {
    return path.join(this.targetDirectory, this.codeDirectory)
  }

  get dataDir() {
    return path.join(this.targetDirectory, this.dataDirectory)
  }

  get configDir() {
    return path.join(this.targetDirectory, this.configDirectory)
  }

  get publicKey() {
    return bufferToHex(privateToPublic(toBuffer(this.privateKey)))
  }

  async getWallet() {
    return getWalletFromPrivateKey(this.privateKey)
  }

  async loadKeystoreDetails() {
    const keystoreDetails = await getKeystoreDetails(this)
    this.set(keystoreDetails)
  }

  async loadChainIds() {
    const answers = await getChainIds(this)
    this.set(answers)
  }

  async loadAccount() {
    if (!this.privateKey || !this.keystorePassword) {
      await this.loadKeystoreDetails()
    }

    // fetch wallet
    const wallet = await this.getWallet()

    // set genesis addresses and address
    this.address = wallet.address
    this.genesisAddresses = [wallet.address]
  }

  print() {
    console.log(chalk.gray('Config json file') + ': ' + chalk.bold.green(this.configFilePath))
    console.log(chalk.gray('Code directory') + ': ' + chalk.bold.green(this.codeDir))
    console.log(chalk.gray('Data directory') + ': ' + chalk.bold.green(this.dataDir))
    console.log(chalk.gray('Address') + ': ' + chalk.bold.green(this.address))
    console.log(chalk.gray('Bor Chain ID') + ': ' + chalk.bold.green(this.borChainId))
    console.log(chalk.gray('Heimdall Chain ID') + ': ' + chalk.bold.green(this.heimdallChainId))
  }
}

export async function loadConfig(options = {}) {
  let { targetDirectory, fileName } = options
  targetDirectory = targetDirectory || process.cwd()
  fileName = fileName || defaultConfigFileName

  // get config file path
  const configFile = path.join(targetDirectory, fileName)

  const hasConfigFile = await fs.exists(configFile)
  if (hasConfigFile) {
    const { override } = await inquirer.prompt({
      type: 'confirm',
      name: 'override',
      message: 'Configuration found in this directory. Do you want to override?'
    })

    if (override) {
      await fs.remove(configFile)
    } else {
      process.exit(0) // exit from the process
    }
  }

  // create new config
  const config = new Config({
    fileName: fileName,
    targetDirectory: targetDirectory,
    ...options
  })

  await execa('mkdir', ['-p', config.configDir, config.dataDir, config.configDir], {
    cwd: config.targetDirectory
  })

  return config
}

export async function saveConfig(config, targetDirectory) {
  const configFile = path.join(targetDirectory, config.fileName || defaultConfigFileName)
  const data = JSON.stringify(config, null, 2)
  return fs.writeFileSync(configFile, data, { mode: 0o755 })
}
