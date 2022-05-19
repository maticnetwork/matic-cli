import inquirer from 'inquirer'
import Listr from 'listr'
import path from 'path'
import chalk from 'chalk'
import execa from 'execa'
import fs from 'fs-extra'
import nunjucks from 'nunjucks'
import { toBuffer, privateToPublic, bufferToHex } from 'ethereumjs-util'

import { Heimdall } from '../heimdall'
import { Bor } from '../bor'
import { Ganache } from '../ganache'
import { Genesis } from '../genesis'
import { printDependencyInstructions, getDefaultBranch } from '../helper'
import { getNewPrivateKey, getKeystoreFile, processTemplateFiles, getAccountFromPrivateKey } from '../../lib/utils'
import { loadConfig } from '../config'
import fileReplacer from '../../lib/file-replacer'

const getAllFiles = function(dirPath, arrayOfFiles) {
  var files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      if(file==="bor" || file==="heimdall"){
        arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
      }
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file))
    }
  })

  return arrayOfFiles
}
export class Devnet {
  constructor(config, options = {}) {
    this.config = config
  }

  get testnetDir() {
    return path.join(this.config.targetDirectory, 'devnet')
  }

  get signerDumpPath() {
    return path.join(this.testnetDir, 'signer-dump.json')
  }

  get signerDumpData() {
    return require(this.signerDumpPath)
  }

  get totalNodes() {
    return this.config.numOfValidators + this.config.numOfNonValidators
  }

  nodeDir(index) {
    return path.join(this.testnetDir, `node${index}`)
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
          const enode = `enode://${pubKey}@${this.config.devnetBorHosts[i]}:30303`

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
          for (let i = 0; i < this.totalNodes; i++) {
            fileReplacer(this.heimdallHeimdallConfigFilePath(i))
              .replace(/eth_rpc_url[ ]*=[ ]*".*"/gi, `eth_rpc_url = "${this.config.ethURL}"`)
              .replace(/bor_rpc_url[ ]*=[ ]*".*"/gi, `bor_rpc_url = "http://bor${i}:8545"`)
              .replace(/amqp_url[ ]*=[ ]*".*"/gi, `amqp_url = "amqp://guest:guest@rabbit${i}:5672/"`)
              .replace(/span_poll_interval[ ]*=[ ]*".*"/gi, 'span_poll_interval = "0m15s"')
              .replace(/checkpoint_poll_interval[ ]*=[ ]*".*"/gi, 'checkpoint_poll_interval = "1m0s"')
              .save()
          }
        }
      },
      {
        title: 'Process contract addresses',
        task: () => {
          // get root contracts
          const rootContracts = this.config.contractAddresses.root

          // set heimdall peers with devnet heimdall hosts
          for (let i = 0; i < this.totalNodes; i++) {
            fileReplacer(this.heimdallGenesisFilePath(i))
              .replace(/"matic_token_address":[ ]*".*"/gi, `"matic_token_address": "${rootContracts.tokens.TestToken}"`)
              .replace(/"staking_manager_address":[ ]*".*"/gi, `"staking_manager_address": "${rootContracts.StakeManagerProxy}"`)
              .replace(/"root_chain_address":[ ]*".*"/gi, `"root_chain_address": "${rootContracts.RootChainProxy}"`)
              .replace(/"staking_info_address":[ ]*".*"/gi, `"staking_info_address": "${rootContracts.StakingInfo}"`)
              .replace(/"state_sender_address":[ ]*".*"/gi, `"state_sender_address": "${rootContracts.StateSender}"`)
              .save()
          }
        },
        enabled: () => {
          return this.config.contractAddresses
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

  async getRemoteTasks() {
    const enodeTask = await this.getEnodeTask()
    return [
      enodeTask,
      {
        title: 'Process Heimdall configs',
        task: async () => {
          // set heimdall
          for (let i = 0; i < this.totalNodes; i++) {
            fileReplacer(this.heimdallHeimdallConfigFilePath(i))
              .replace(/eth_rpc_url[ ]*=[ ]*".*"/gi, `eth_rpc_url = "${this.config.ethURL}"`)
              .replace(/bor_rpc_url[ ]*=[ ]*".*"/gi, 'bor_rpc_url = "http://localhost:8545"')
              .replace(/amqp_url[ ]*=[ ]*".*"/gi, 'amqp_url = "amqp://guest:guest@localhost:5672/"')
              .save()
          }
        }
      },
      {
        title: 'Process contract addresses',
        task: () => {
          // get root contracts
          const rootContracts = this.config.contractAddresses.root

          // set heimdall peers with devnet heimdall hosts
          for (let i = 0; i < this.totalNodes; i++) {
            fileReplacer(this.heimdallGenesisFilePath(i))
              .replace(/"matic_token_address":[ ]*".*"/gi, `"matic_token_address": "${rootContracts.tokens.TestToken}"`)
              .replace(/"staking_manager_address":[ ]*".*"/gi, `"staking_manager_address": "${rootContracts.StakeManagerProxy}"`)
              .replace(/"root_chain_address":[ ]*".*"/gi, `"root_chain_address": "${rootContracts.RootChainProxy}"`)
              .replace(/"staking_info_address":[ ]*".*"/gi, `"staking_info_address": "${rootContracts.StakingInfo}"`)
              .replace(/"state_sender_address":[ ]*".*"/gi, `"state_sender_address": "${rootContracts.StateSender}"`)
              .save()
          }
        },
        enabled: () => {
          return this.config.contractAddresses
        }
      },
      {
        title: 'Process templates',
        task: async () => {
          const templateDir = path.resolve(
            new URL(import.meta.url).pathname,
            '../templates'
          )

          // copy remote related templates
          await fs.copy(path.join(templateDir, 'remote'), this.config.targetDirectory)

          // promises
          const p = []
          const signerDumpData = this.signerDumpData
          // process njk files
          getAllFiles(this.config.targetDirectory,[]).forEach(async(file) => {
            if (file.indexOf('.njk') !== -1) {
              const fp = path.join(this.config.targetDirectory, file)

              // process all njk files and copy to each node directory
              for (let i = 0; i < this.totalNodes; i++) {
                var file2array = file.split("/")
                let file2 = file2array[file2array.length-1]
                fs.writeFileSync(
                  path.join(this.nodeDir(i), file2.replace('.njk', '')),
                  nunjucks.render(file, { obj: this, node: i, signerData: signerDumpData[i] })
                )
              }

              // remove njk file
              p.push(execa('rm', ['-rf', fp], {
                cwd: this.config.targetDirectory
              }))
            }
          })

          // fulfill all promises
          await Promise.all(p)
        }
      },
      {
        title: 'Copy files to remote servers',
        task: async () => {
          if(this.config.devnetBorHosts===undefined){
              return
          }
          for(let i=0; i<this.totalNodes; i++) {

            // copy files to remote servers

            await execa('scp', [`${this.config.targetDirectory}/code/bor/build/bin/bor`,`ubuntu@${this.config.devnetBorHosts[i]}:/home/ubuntu/go/bin/bor`])
            await execa('scp', [`${this.config.targetDirectory}/code/heimdall/build/heimdalld`,`ubuntu@${this.config.devnetBorHosts[i]}:/home/ubuntu/go/bin/heimdalld`])
            await execa('scp', [`${this.config.targetDirectory}/code/heimdall/build/heimdallcli`,`ubuntu@${this.config.devnetBorHosts[i]}:/home/ubuntu/go/bin/heimdallcli`])
            await execa('scp', [`${this.config.targetDirectory}/code/heimdall/build/bridge`,`ubuntu@${this.config.devnetBorHosts[i]}:/home/ubuntu/go/bin/bridge`])

            await execa('scp', [ `-r`,`${this.testnetDir}/node${i}/`,`ubuntu@${this.config.devnetBorHosts[i]}:~/node/`])

          }

          // copy the Ganache files to the first node
          await execa('scp', [`${this.config.targetDirectory}/ganache-start-remote.sh`,`ubuntu@${this.config.devnetBorHosts[0]}:~/ganache-start-remote.sh`])
          await execa('scp', [`-r`,`${this.config.targetDirectory}/data`,`ubuntu@${this.config.devnetBorHosts[0]}:~/data`])
        }
      }
    ]
  }

  async getCreateTestnetTask(heimdall) {
    return [
      heimdall.cloneRepositoryTask(),
      heimdall.buildTask(),
      {
        title: 'Create testnet files for Heimdall',
        task: async () => {
          const args = [
            'create-testnet',
            '--v', this.config.numOfValidators,
            '--n', this.config.numOfNonValidators,
            '--chain-id', this.config.heimdallChainId,
            '--node-host-prefix', 'heimdall',
            '--output-dir', 'devnet'
          ]

          // create testnet
          await execa(heimdall.heimdalldCmd, args, {
            cwd: this.config.targetDirectory
          })

          // set heimdall peers with devnet heimdall hosts
          for (let i = 0; i < this.totalNodes; i++) {
            fileReplacer(this.heimdallConfigFilePath(i))
              .replace(/heimdall([^:]+):/gi, (d, index) => {
                return `${this.config.devnetHeimdallHosts[index]}:`
              })
              .replace(/moniker.+=.+/gi, `moniker = "heimdall${i}"`)
              .save()

            fileReplacer(this.heimdallGenesisFilePath(i))
              .replace(/"bor_chain_id"[ ]*:[ ]*".*"/gi, `"bor_chain_id": "${this.config.borChainId}"`)
              .save()
          }
        }
      }
    ]
  }

  async getTasks() {
    const ganache = this.ganache
    const heimdall = this.heimdall
    const bor = this.bor
    const genesis = this.genesis

    // create testnet tasks
    const createTestnetTasks = await this.getCreateTestnetTask(heimdall)

    return new Listr(
      [
        ...createTestnetTasks,
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
          title: bor.taskTitle,
          task: () => {
            return bor.getTasks()
          },
          enabled: () => {
            return this.config.devnetType === 'remote'
          }
        },
        {
          title: genesis.taskTitle,
          task: () => {
            // get genesis tasks
            return genesis.getTasks()
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
                execa('cp', [genesis.borGenesisFilePath, this.borGenesisFilePath(i)])
              ]
              await Promise.all(p)
            }
          }
        },
        {
          title: ganache.taskTitle,
          task: () => {
            return ganache.getTasks()
          },
          enabled: () => {
            return this.config.devnetType === 'docker' || 'remote'
          }
        },
        {
          title: 'Docker',
          task: async () => {
            const tasks = await this.getDockerTasks()
            return new Listr(tasks)
          },
          enabled: () => {
            return this.config.devnetType === 'docker'
          }
        },
        {
          title: 'Remote',
          task: async () => {
            const tasks = await this.getRemoteTasks()
            return new Listr(tasks)
          },
          enabled: () => {
            return this.config.devnetType === 'remote'
          }
        }
      ]
    )
  }
}

async function setupDevnet(config) {
  const devnet = new Devnet(config)
  devnet.ganache = new Ganache(config, { contractsBranch: config.contractsBranch })
  devnet.bor = new Bor(config, { repositoryBranch: config.borBranch })
  devnet.heimdall = new Heimdall(config, { repositoryBranch: config.heimdallBranch })
  devnet.genesis = new Genesis(config, { repositoryBranch: 'master' })

  const tasks = await devnet.getTasks()
  await tasks.run()
  console.log('%s Devnet is ready', chalk.green.bold('DONE'))
}

export async function getHosts(n) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'devnetHosts',
      message: 'Please enter comma separated hosts/IPs',
      validate: (input) => {
        const hosts = input.split(',').map(a => {
          return a.trim().toLowerCase()
        })

        if (hosts.length === 0 || hosts.length !== n) {
          return `Enter valid ${n} hosts/IPs (comma separated)`
        }

        return true
      }
    }
  ])

  return answers.devnetHosts.split(',').map(a => {
    return a.trim().toLowerCase()
  })
}

export default async function () {
  await printDependencyInstructions()

  // configuration
  const config = await loadConfig()
  await config.loadChainIds()

  // load branch
  let answers = await getDefaultBranch(config)
  config.set(answers)

  const questions = []
  if (!('numOfValidators' in config)) {
    questions.push({
      type: 'number',
      name: 'numOfValidators',
      message: 'Please enter number of validator nodes',
      default: 2
    })
  }

  if (!('numOfNonValidators' in config)) {
    questions.push({
      type: 'number',
      name: 'numOfNonValidators',
      message: 'Please enter number of non-validator nodes',
      default: 0
    })
  }

  if (!('ethURL' in config)) {
    questions.push({
      type: 'input',
      name: 'ethURL',
      message: 'Please enter ETH url',
      default: 'http://ganache:9545'
    })
  }

  if (!('devnetType' in config)) {
    questions.push({
      type: 'list',
      name: 'devnetType',
      message: 'Please select devnet type',
      choices: [
        'docker',
        'remote'
      ]
    })
  }

  answers = await inquirer.prompt(questions)
  config.set(answers)

  // set devent hosts
  let devnetBorHosts = []
  let devnetHeimdallHosts = []
  const totalValidators = config.numOfValidators + config.numOfNonValidators
  if (config.devnetType === 'docker') {
    [...Array(totalValidators).keys()].forEach((i) => {
      devnetBorHosts.push(`172.20.1.${i + 100}`)
      devnetHeimdallHosts.push(`heimdall${i}`)
    })
  } else {
    const hosts = await getHosts(totalValidators)
    devnetBorHosts = hosts
    devnetHeimdallHosts = hosts
  }
  config.set({ devnetBorHosts, devnetHeimdallHosts })

  // start setup
  await setupDevnet(config)
}
