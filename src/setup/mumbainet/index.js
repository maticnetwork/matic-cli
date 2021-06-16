import inquirer from 'inquirer'
import Listr from 'listr'
import path from 'path'
import chalk from 'chalk'
import execa from 'execa'
import fs from 'fs-extra'
import nunjucks from 'nunjucks'
import { toBuffer, privateToPublic, bufferToHex } from 'ethereumjs-util'

import { writeFile } from 'fs';

import { Heimdall } from '../heimdall'
import { Genesis } from '../genesis'
import { printDependencyInstructions, getDefaultBranch } from '../helper'
import { getNewPrivateKey, getKeystoreFile, processTemplateFiles, getAccountFromPrivateKey } from '../../lib/utils'
import { loadConfig } from '../config'
import fileReplacer from '../../lib/file-replacer'

var wget = require('node-wget');

export class Mumbainet {
  constructor(config, options = {}) {
    this.config = config
  }

  get mumbainetDir() {
    return path.join(this.config.targetDirectory, 'mumbainet')
  }

  get signerDumpPath() {
    return path.join(this.mumbainetDir, 'signer-dump.json')
  }

  get signerDumpData() {
    return require(this.signerDumpPath)
  }

  get totalNodes() {
    return 1
  }

  nodeDir(index) {
    return path.join(this.mumbainetDir, `node${index}`)
  }

  heimdallDir(index) {
    return path.join(this.nodeDir(index), 'heimdalld')
  }

  heimdallConfigFilePath(index) {
    return path.join(this.heimdallDir(index), 'config', 'config.toml')
  }

  heimdallGenesisFilePath(index) {
    return path.join(this.heimdallDir(index), 'config', 'genesis.json')
  }

  heimdallHeimdallConfigFilePath(index) {
    return path.join(this.heimdallDir(index), 'config', 'heimdall-config.toml')
  }

  borDir(index) {
    return path.join(this.nodeDir(index), 'bor')
  }

  borDataDir(index) {
    return path.join(this.borDir(index), 'data')
  }

  borDataBorDir(index) {
    return path.join(this.borDir(index), 'data', 'bor')
  }

  borKeystoreDir(index) {
    return path.join(this.borDir(index), 'keystore')
  }

  borGenesisFilePath(index) {
    return path.join(this.borDir(index), 'genesis.json')
  }

  borPasswordFilePath(index) {
    return path.join(this.borDir(index), 'password.txt')
  }

  borPrivateKeyFilePath(index) {
    return path.join(this.borDir(index), 'privatekey.txt')
  }

  borAddressFilePath(index) {
    return path.join(this.borDir(index), 'address.txt')
  }

  borNodeKeyPath(index) {
    return path.join(this.borDir(index), 'nodekey')
  }

  borEnodeFilePath(index) {
    return path.join(this.borDir(index), 'enode.txt')
  }

  borStaticNodesPath(index) {
    return path.join(this.borDir(index), 'static-nodes.json')
  }

  async getEnodeTask() {
    return {
      title: 'Setup enode',
      task: async () => {
        const staticNodes = []

        // create new enode
        for (let i = 0; i < this.totalNodes; i++) {
          const enodeObj = await getNewPrivateKey()
          const pubKey = bufferToHex(privateToPublic(toBuffer(enodeObj.privateKey))).replace('0x', '')

          // draft enode
          const enode = `enode://320553cda00dfc003f499a3ce9598029f364fbb3ed1222fdc20a94d97dcc4d8ba0cd0bfa996579dcc6d17a534741fb0a5da303a90579431259150de66b597251@54.147.31.250:30303`

          // add into static nodes
          staticNodes.push(enode)

          // store data into nodekey and enode
          const p = [
            // create nodekey file
            fs.writeFile(
              this.borNodeKeyPath(i),
              `${enodeObj.privateKey.replace('0x', '')}\n`,
              { mode: 0o600 }
            ),
            // create enode file
            fs.writeFile(
              this.borEnodeFilePath(i),
              `${enode}\n`,
              { mode: 0o600 }
            )
          ]
          await Promise.all(p)
        }

        // create static-nodes
        const data = JSON.stringify(staticNodes, null, 2)
        for (let i = 0; i < this.totalNodes; i++) {
          await fs.writeFile(
            this.borStaticNodesPath(i),
            data,
            { mode: 0o600 }
          )
        }
      }
    }
  }

  async getDockerTasks() {
    const enodeTask = await this.getEnodeTask()
    return [
      enodeTask,
      {
        title: 'Process Heimdall configs',
        task: async () => {
          // set heimdall
          fileReplacer(this.heimdallHeimdallConfigFilePath(0))
            .replace(/eth_rpc_url[ ]*=[ ]*".*"/gi, `eth_rpc_url = "${this.config.ethURL}"`)
            .replace(/bor_rpc_url[ ]*=[ ]*".*"/gi, `bor_rpc_url = "http://bor0:8545"`)
            .save()
        }
      },
      {
        title: 'Process templates',
        task: async () => {
          const templateDir = path.resolve(
            new URL(import.meta.url).pathname,
            '../templates'
          )

          // copy docker related templates
          await fs.copy(path.join(templateDir, 'docker'), this.config.targetDirectory)

          // process template files
          await processTemplateFiles(this.config.targetDirectory, { obj: this, ganache: this.ganache })
        }
      }
    ]
  }

  async getCreateMumbainetTask(heimdall) {
    return [
      heimdall.cloneRepositoryTask(),
      heimdall.buildTask(),
      {
        title: 'Create mumbainet files for Heimdall',
        task: async () => {
          const args = [
            'create-testnet',
            '--v', 0,
            '--n', 1,
            '--chain-id', this.config.heimdallChainId,
            '--node-host-prefix', 'heimdall',
            '--output-dir', 'mumbainet'
          ]

          // create mumbainet
          await execa(heimdall.heimdalldCmd, args, {
            cwd: this.config.targetDirectory
          })

          // set heimdall peers with mumbainet heimdall hosts
          fileReplacer(this.heimdallConfigFilePath(0))
            .replace(/moniker.+=.+/gi, `moniker = "heimdall0"`)
            .replace(/seeds.+=.+/gi, `seeds = "4cd60c1d76e44b05f7dfd8bab3f447b119e87042@54.147.31.250:26656,b18bbe1f3d8576f4b73d9b18976e71c65e839149@34.226.134.117:26656"`)
            .replace(/persistent_peers.+=.+/gi, `persistent_peers = ""`)
            .save()
          wget({url: "https://raw.githubusercontent.com/maticnetwork/launch/master/testnet-v4/sentry/sentry/heimdall/config/genesis.json", dest: this.heimdallGenesisFilePath(0)})
        }
      }
    ]
  }

  async getTasks() {
    const heimdall = this.heimdall
    const genesis = this.genesis

    // create mumbainet tasks
    const createMumbainetTasks = await this.getCreateMumbainetTask(heimdall)

    return new Listr(
      [
        ...createMumbainetTasks,
        {
          title: 'Setup accounts',
          task: () => {
            // set validator addresses
            const genesisAddresses = []
            const signerDumpData = this.signerDumpData
            for (let i = 0; i < this.config.numOfValidators; i++) {
              const d = signerDumpData[i]
              genesisAddresses.push(d.address)
            }

            // set genesis addresses
            this.config.genesisAddresses = genesisAddresses

            // setup accounts from signer dump data (based on number of validators)
            this.config.accounts = this.signerDumpData.slice(0, this.config.numOfValidators).map(s => {
              return getAccountFromPrivateKey(s.priv_key)
            })
          }
        },
        {
          title: 'Setup Bor keystore and genesis files',
          task: async () => {
            const signerDumpData = this.signerDumpData

            for (let i = 0; i < this.totalNodes; i++) {
              // create directories
              await execa('mkdir', ['-p', this.borDataDir(i), this.borKeystoreDir(i)])
              const password = `password${i}`

              // create keystore files
              const keystoreFileObj = getKeystoreFile(signerDumpData[i].priv_key, password)
              const p = [
                // save password file
                fs.writeFile(
                  this.borPasswordFilePath(i),
                  `${password}\n`
                ),
                // save private key file
                fs.writeFile(
                  this.borPrivateKeyFilePath(i),
                  `${signerDumpData[i].priv_key}\n`
                ),
                // save address file
                fs.writeFile(
                  this.borAddressFilePath(i),
                  `${signerDumpData[i].address}\n`
                ),
                // save keystore file
                fs.writeFile(
                  path.join(this.borKeystoreDir(i), keystoreFileObj.keystoreFilename),
                  JSON.stringify(keystoreFileObj.keystore, null, 2)
                ),
                // copy genesis file to each node bor directory
                wget({url: "https://raw.githubusercontent.com/maticnetwork/launch/master/testnet-v4/sentry/sentry/bor/genesis.json", dest: this.borGenesisFilePath(i)})
              ]
              await Promise.all(p)
            }
          }
        },
        {
          title: 'Docker',
          task: async () => {
            const tasks = await this.getDockerTasks()
            return new Listr(tasks)
          }
        }
      ]
    )
  }
}

async function setupMumbainet(config) {
  const mumbainet = new Mumbainet(config)
  mumbainet.heimdall = new Heimdall(config, { repositoryBranch: config.heimdallBranch })
  mumbainet.genesis = new Genesis(config, { repositoryBranch: 'master' })

  const tasks = await mumbainet.getTasks()
  await tasks.run()
  console.log('%s Mumbainet is ready', chalk.green.bold('DONE'))
}

export default async function () {

  const config = await loadConfig()

  let numOfValidators = 0
  let numOfNonValidators = 1
  let ethURL = ""
  let mumbainetType = "docker"
  let heimdallBranch = "v0.2.1-mumbai"
  config.heimdallBranch = heimdallBranch
  let borBranch = "v0.2.6"
  config.borBranch = borBranch
  let borChainId = "80001"
  let heimdallChainId = "heimdall-80001"

  // set devent hosts
  let mumbainetBorHosts = []
  let mumbainetHeimdallHosts = []
  const totalValidators = 1
  mumbainetBorHosts.push(`172.20.1.100`)
  mumbainetHeimdallHosts.push(`heimdall0`)
  config.set({ mumbainetBorHosts, mumbainetHeimdallHosts })

  // start setup
  await setupMumbainet(config)
}
