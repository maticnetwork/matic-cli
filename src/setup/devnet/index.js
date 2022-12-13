// noinspection JSUnresolvedFunction,JSUnresolvedVariable

import inquirer from 'inquirer'
import Listr from 'listr'
import path from 'path'
import chalk from 'chalk'
import execa from 'execa'
import fs from 'fs-extra'
import nunjucks from 'nunjucks'
import { bufferToHex, privateToPublic, toBuffer } from 'ethereumjs-util'

import { Heimdall } from '../heimdall'
import { Bor } from '../bor'
import { Ganache } from '../ganache'
import { Genesis } from '../genesis'
import { getDefaultBranch } from '../helper'
import {
  errorMissingConfigs,
  getAccountFromPrivateKey,
  getKeystoreFile,
  getNewPrivateKey,
  processTemplateFiles
} from '../../lib/utils'
import { loadConfig } from '../config'
import fileReplacer from '../../lib/file-replacer'
import { getRemoteStdio } from '../../express/common/remote-worker'

const timer = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const getAllFiles = function (dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function (file) {
    if (fs.statSync(dirPath + '/' + file).isDirectory()) {
      if (file === 'bor' || file === 'heimdall') {
        arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles)
      }
    } else {
      arrayOfFiles.push(path.join(dirPath, '/', file))
    }
  })

  return arrayOfFiles
}

export class Devnet {
  constructor (config) {
    this.config = config
  }

  get testnetDir () {
    return path.join(this.config.targetDirectory, 'devnet')
  }

  get signerDumpPath () {
    return path.join(this.testnetDir, 'signer-dump.json')
  }

  get signerDumpData () {
    return require(this.signerDumpPath)
  }

  get totalNodes () {
    // noinspection JSUnresolvedVariable
    return this.config.numOfValidators + this.config.numOfNonValidators
  }

  nodeDir (index) {
    return path.join(this.testnetDir, `node${index}`)
  }

  heimdallDir (index) {
    return path.join(this.nodeDir(index), 'heimdalld')
  }

  heimdallConfigFilePath (index) {
    return path.join(this.heimdallDir(index), 'config', 'config.toml')
  }

  heimdallGenesisFilePath (index) {
    return path.join(this.heimdallDir(index), 'config', 'genesis.json')
  }

  heimdallHeimdallConfigFilePath (index) {
    return path.join(this.heimdallDir(index), 'config', 'heimdall-config.toml')
  }

  borDir (index) {
    return path.join(this.nodeDir(index), 'bor')
  }

  borDataDir (index) {
    return path.join(this.borDir(index), 'data')
  }

  borKeystoreDir (index) {
    return path.join(this.borDir(index), 'keystore')
  }

  borGenesisFilePath (index) {
    return path.join(this.borDir(index), 'genesis.json')
  }

  borPasswordFilePath (index) {
    return path.join(this.borDir(index), 'password.txt')
  }

  borPrivateKeyFilePath (index) {
    return path.join(this.borDir(index), 'privatekey.txt')
  }

  borAddressFilePath (index) {
    return path.join(this.borDir(index), 'address.txt')
  }

  borNodeKeyPath (index) {
    return path.join(this.borDir(index), 'nodekey')
  }

  borEnodeFilePath (index) {
    return path.join(this.borDir(index), 'enode.txt')
  }

  borStaticNodesPath (index) {
    return path.join(this.borDir(index), 'static-nodes.json')
  }

  async getEnodeTask () {
    return {
      title: 'Setup enode',
      task: async () => {
        const staticNodes = []

        // create new enode
        for (let i = 0; i < this.totalNodes; i++) {
          const enodeObj = await getNewPrivateKey()
          const pubKey = bufferToHex(
            privateToPublic(toBuffer(enodeObj.privateKey))
          ).replace('0x', '')

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
            fs.writeFile(this.borEnodeFilePath(i), `${enode}\n`, {
              mode: 0o600
            })
          ]
          await Promise.all(p)
        }

        // create static-nodes
        const data = JSON.stringify(staticNodes, null, 2)
        for (let i = 0; i < this.totalNodes; i++) {
          await fs.writeFile(this.borStaticNodesPath(i), data, { mode: 0o600 })
        }
      }
    }
  }

  async getDockerTasks () {
    const enodeTask = await this.getEnodeTask()
    return [
      enodeTask,
      {
        title: 'Process Heimdall configs',
        task: async () => {
          // set heimdall
          for (let i = 0; i < this.totalNodes; i++) {
            fileReplacer(this.heimdallHeimdallConfigFilePath(i))
              .replace(
                /eth_rpc_url[ ]*=[ ]*".*"/gi,
                `eth_rpc_url = "${this.config.ethURL}"`
              )
              .replace(
                /bor_rpc_url[ ]*=[ ]*".*"/gi,
                `bor_rpc_url = "http://bor${i}:8545"`
              )
              .replace(
                /amqp_url[ ]*=[ ]*".*"/gi,
                `amqp_url = "amqp://guest:guest@rabbit${i}:5672/"`
              )
              .replace(
                /span_poll_interval[ ]*=[ ]*".*"/gi,
                'span_poll_interval = "0m15s"'
              )
              .replace(
                /checkpoint_poll_interval[ ]*=[ ]*".*"/gi,
                'checkpoint_poll_interval = "1m0s"'
              )
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
              .replace(
                /"matic_token_address":[ ]*".*"/gi,
                `"matic_token_address": "${rootContracts.tokens.TestToken}"`
              )
              .replace(
                /"staking_manager_address":[ ]*".*"/gi,
                `"staking_manager_address": "${rootContracts.StakeManagerProxy}"`
              )
              .replace(
                /"root_chain_address":[ ]*".*"/gi,
                `"root_chain_address": "${rootContracts.RootChainProxy}"`
              )
              .replace(
                /"staking_info_address":[ ]*".*"/gi,
                `"staking_info_address": "${rootContracts.StakingInfo}"`
              )
              .replace(
                /"state_sender_address":[ ]*".*"/gi,
                `"state_sender_address": "${rootContracts.StateSender}"`
              )
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
          await fs.copy(
            path.join(templateDir, 'docker'),
            this.config.targetDirectory
          )

          // process template files
          await processTemplateFiles(this.config.targetDirectory, {
            obj: this,
            ganache: this.ganache
          })
        }
      }
    ]
  }

  async getRemoteTasks () {
    const enodeTask = await this.getEnodeTask()
    return [
      enodeTask,
      {
        title: 'Process Heimdall configs',
        task: async () => {
          // set heimdall
          for (let i = 0; i < this.totalNodes; i++) {
            fileReplacer(this.heimdallHeimdallConfigFilePath(i))
              .replace(
                /eth_rpc_url[ ]*=[ ]*".*"/gi,
                `eth_rpc_url = "${this.config.ethURL}"`
              )
              .replace(
                /bor_rpc_url[ ]*=[ ]*".*"/gi,
                'bor_rpc_url = "http://localhost:8545"'
              )
              .replace(
                /amqp_url[ ]*=[ ]*".*"/gi,
                'amqp_url = "amqp://guest:guest@localhost:5672/"'
              )
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
              .replace(
                /"matic_token_address":[ ]*".*"/gi,
                `"matic_token_address": "${rootContracts.tokens.TestToken}"`
              )
              .replace(
                /"staking_manager_address":[ ]*".*"/gi,
                `"staking_manager_address": "${rootContracts.StakeManagerProxy}"`
              )
              .replace(
                /"root_chain_address":[ ]*".*"/gi,
                `"root_chain_address": "${rootContracts.RootChainProxy}"`
              )
              .replace(
                /"staking_info_address":[ ]*".*"/gi,
                `"staking_info_address": "${rootContracts.StakingInfo}"`
              )
              .replace(
                /"state_sender_address":[ ]*".*"/gi,
                `"state_sender_address": "${rootContracts.StateSender}"`
              )
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
          await fs.copy(
            path.join(templateDir, 'remote'),
            this.config.targetDirectory
          )

          // promises
          const p = []
          const signerDumpData = this.signerDumpData
          // process njk files
          for (const file of getAllFiles(this.config.targetDirectory, [])) {
            if (file.indexOf('.njk') !== -1) {
              const fp = path.join(this.config.targetDirectory, file)

              // process all njk files and copy to each node directory
              for (let i = 0; i < this.totalNodes; i++) {
                const file2array = file.split('/')
                const file2 = file2array[file2array.length - 1]
                fs.writeFileSync(
                  path.join(this.nodeDir(i), file2.replace('.njk', '')),
                  nunjucks.render(file, {
                    obj: this,
                    node: i,
                    signerData: signerDumpData[i]
                  })
                )
              }

              // remove njk file
              p.push(
                execa('rm', ['-rf', fp], {
                  cwd: this.config.targetDirectory,
                  stdio: getRemoteStdio()
                })
              )
            }
          }

          // fulfill all promises
          await Promise.all(p)
        }
      },
      {
        title: 'Copy files to remote servers',
        task: async () => {
          if (this.config.devnetBorHosts === undefined) {
            return
          }
          // copy the Ganache files to the first node

          const ganacheURL = new URL(this.config.ethURL)
          const ganacheUser = this.config.ethHostUser

          await execa(
            'scp',
            [
              '-o',
              'StrictHostKeyChecking=no',
              '-o',
              'UserKnownHostsFile=/dev/null',
              '-i',
              '~/cert.pem',
              `${this.config.targetDirectory}/ganache-start-remote.sh`,
              `${ganacheUser}@${ganacheURL.hostname}:~/ganache-start-remote.sh`
            ],
            { stdio: getRemoteStdio() }
          )

          await execa(
            'scp',
            [
              '-o',
              'StrictHostKeyChecking=no',
              '-o',
              'UserKnownHostsFile=/dev/null',
              '-r',
              '-i',
              '~/cert.pem',
              `${this.config.targetDirectory}/data`,
              `${ganacheUser}@${ganacheURL.hostname}:~/data`
            ],
            { stdio: getRemoteStdio() }
          )

          // Generate service files
          for (let i = 0; i < this.totalNodes; i++) {
            await execa(
              'scp',
              [
                '-o',
                'StrictHostKeyChecking=no',
                '-o',
                'UserKnownHostsFile=/dev/null',
                '-i',
                '~/cert.pem',
                `${this.config.targetDirectory}/service.sh`,
                `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}:~/service.sh`
              ],
              { stdio: getRemoteStdio() }
            )

            if (i === 0) {
              await execa(
                'ssh',
                [
                  '-o',
                  'StrictHostKeyChecking=no',
                  '-o',
                  'UserKnownHostsFile=/dev/null',
                  '-i',
                  '~/cert.pem',
                  `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}`,
                  `bash ${this.config.targetDirectory}/service-host.sh`
                ],
                { stdio: getRemoteStdio() }
              )

              await execa(
                'ssh',
                [
                  '-o',
                  'StrictHostKeyChecking=no',
                  '-o',
                  'UserKnownHostsFile=/dev/null',
                  '-i',
                  '~/cert.pem',
                  `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}`,
                  'sudo mv ~/ganache.service /lib/systemd/system/'
                ],
                { stdio: getRemoteStdio() }
              )
            } else {
              await execa(
                'ssh',
                [
                  '-o',
                  'StrictHostKeyChecking=no',
                  '-o',
                  'UserKnownHostsFile=/dev/null',
                  '-i',
                  '~/cert.pem',
                  `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}`,
                  'bash ~/service.sh'
                ],
                { stdio: getRemoteStdio() }
              )
            }

            await execa(
              'ssh',
              [
                '-o',
                'StrictHostKeyChecking=no',
                '-o',
                'UserKnownHostsFile=/dev/null',
                '-i',
                '~/cert.pem',
                `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}`,
                'sudo mv ~/bor.service /lib/systemd/system/'
              ],
              { stdio: getRemoteStdio() }
            )

            await execa(
              'ssh',
              [
                '-o',
                'StrictHostKeyChecking=no',
                '-o',
                'UserKnownHostsFile=/dev/null',
                '-i',
                '~/cert.pem',
                `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}`,
                'sudo mv ~/heimdalld.service /lib/systemd/system/'
              ],
              { stdio: getRemoteStdio() }
            )
          }

          for (let i = 0; i < this.totalNodes; i++) {
            // copy files to remote servers
            await execa(
              'scp',
              [
                '-o',
                'StrictHostKeyChecking=no',
                '-o',
                'UserKnownHostsFile=/dev/null',
                '-i',
                '~/cert.pem',
                `${this.config.targetDirectory}/code/bor/build/bin/bor`,
                `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}:~/go/bin/bor`
              ],
              { stdio: getRemoteStdio() }
            )

            await execa(
              'scp',
              [
                '-o',
                'StrictHostKeyChecking=no',
                '-o',
                'UserKnownHostsFile=/dev/null',
                '-i',
                '~/cert.pem',
                `${this.config.targetDirectory}/code/heimdall/build/heimdalld`,
                `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}:~/go/bin/heimdalld`
              ],
              { stdio: getRemoteStdio() }
            )

            await execa(
              'scp',
              [
                '-o',
                'StrictHostKeyChecking=no',
                '-o',
                'UserKnownHostsFile=/dev/null',
                '-i',
                '~/cert.pem',
                `${this.config.targetDirectory}/code/heimdall/build/heimdallcli`,
                `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}:~/go/bin/heimdallcli`
              ],
              { stdio: getRemoteStdio() }
            )

            await execa(
              'scp',
              [
                '-o',
                'StrictHostKeyChecking=no',
                '-o',
                'UserKnownHostsFile=/dev/null',
                '-r',
                '-i',
                '~/cert.pem',
                `${this.testnetDir}/node${i}/`,
                `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}:~/node/`
              ],
              { stdio: getRemoteStdio() }
            )

            // Execute service files
            if (i === 0) {
              await execa(
                'ssh',
                [
                  '-o',
                  'StrictHostKeyChecking=no',
                  '-o',
                  'UserKnownHostsFile=/dev/null',
                  '-i',
                  '~/cert.pem',
                  `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}`,
                  'sudo systemctl start ganache.service'
                ],
                { stdio: getRemoteStdio() }
              )
            }

            await execa(
              'ssh',
              [
                '-o',
                'StrictHostKeyChecking=no',
                '-o',
                'UserKnownHostsFile=/dev/null',
                '-i',
                '~/cert.pem',
                `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}`,
                'bash ~/node/heimdalld-setup.sh'
              ],
              { stdio: getRemoteStdio() }
            )

            await execa(
              'ssh',
              [
                '-o',
                'StrictHostKeyChecking=no',
                '-o',
                'UserKnownHostsFile=/dev/null',
                '-i',
                '~/cert.pem',
                `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}`,
                'sudo ln -sf ~/go/bin/heimdalld /usr/bin/heimdalld'
              ],
              { stdio: getRemoteStdio() }
            )

            await execa(
              'ssh',
              [
                '-o',
                'StrictHostKeyChecking=no',
                '-o',
                'UserKnownHostsFile=/dev/null',
                '-i',
                '~/cert.pem',
                `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}`,
                'sudo systemctl start heimdalld.service'
              ],
              { stdio: getRemoteStdio() }
            )

            await execa(
              'ssh',
              [
                '-o',
                'StrictHostKeyChecking=no',
                '-o',
                'UserKnownHostsFile=/dev/null',
                '-i',
                '~/cert.pem',
                `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}`,
                'bash ~/node/bor-setup.sh '
              ],
              { stdio: getRemoteStdio() }
            )

            await execa(
              'ssh',
              [
                '-o',
                'StrictHostKeyChecking=no',
                '-o',
                'UserKnownHostsFile=/dev/null',
                '-i',
                '~/cert.pem',
                `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}`,
                'sudo systemctl start bor.service'
              ],
              { stdio: getRemoteStdio() }
            )
          }
        }
      }
    ]
  }

  async getCreateTestnetTask (heimdall) {
    return [
      heimdall.cloneRepositoryTask(),
      heimdall.buildTask(),
      {
        title: 'Create testnet files for Heimdall',
        task: async () => {
          const args = [
            'create-testnet',
            '--home',
            'devnet',
            '--v',
            this.config.numOfValidators,
            '--n',
            this.config.numOfNonValidators,
            '--chain-id',
            this.config.heimdallChainId,
            '--node-host-prefix',
            'heimdall',
            '--output-dir',
            'devnet'
          ]

          // Create heimdall folders
          if (this.config.devnetType === 'remote') {
            // create heimdall folder for all the nodes in remote setup
            for (let i = 0; i < this.totalNodes; i++) {
              await execa(
                'ssh',
                [
                  '-o',
                  'StrictHostKeyChecking=no',
                  '-o',
                  'UserKnownHostsFile=/dev/null',
                  '-i',
                  '~/cert.pem',
                  `${this.config.devnetBorUsers[i]}@${this.config.devnetBorHosts[i]}`,
                  'sudo mkdir -p /var/lib/heimdall && sudo chmod 777 -R /var/lib/heimdall/'
                ],
                { stdio: getRemoteStdio() }
              )
            }
          }

          // create testnet
          await execa(heimdall.heimdalldCmd, args, {
            cwd: this.config.targetDirectory,
            stdio: getRemoteStdio()
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
              .replace(
                /"bor_chain_id"[ ]*:[ ]*".*"/gi,
                `"bor_chain_id": "${this.config.borChainId}"`
              )
              .save()
          }
        }
      }
    ]
  }

  async getTasks () {
    const ganache = this.ganache
    const heimdall = this.heimdall
    const bor = this.bor
    const genesis = this.genesis

    // create testnet tasks
    const createTestnetTasks = await this.getCreateTestnetTask(heimdall)

    return new Listr([
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
          this.config.accounts = this.signerDumpData
            .slice(0, this.config.numOfValidators)
            .map((s) => {
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
            await execa(
              'mkdir',
              ['-p', this.borDataDir(i), this.borKeystoreDir(i)],
              { stdio: getRemoteStdio() }
            )
            const password = `password${i}`

            // create keystore files
            const keystoreFileObj = getKeystoreFile(
              signerDumpData[i].priv_key,
              password
            )
            const p = [
              // save password file
              fs.writeFile(this.borPasswordFilePath(i), `${password}\n`),
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
                path.join(
                  this.borKeystoreDir(i),
                  keystoreFileObj.keystoreFilename
                ),
                JSON.stringify(keystoreFileObj.keystore, null, 2)
              ),
              // copy genesis file to each node bor directory
              execa(
                'cp',
                [genesis.borGenesisFilePath, this.borGenesisFilePath(i)],
                { stdio: getRemoteStdio() }
              )
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
        title: 'Remove multiple keystore files',
        task: async () => {
          for (let i = 0; i < this.totalNodes; i++) {
            // remove multiple keystore files from node[i]/bor/keystore
            const keystoreDir = path.join(
              this.testnetDir,
              `node${i}`,
              'bor',
              'keystore'
            )
            fs.readdir(keystoreDir, async (err, files) => {
              if (err) throw err

              for (let j = 1; j < files.length; j++) {
                await fs.unlink(path.join(keystoreDir, files[j]), (err) => {
                  if (err) throw err
                })
              }
            })
            await timer(2000)
          }
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
    ])
  }
}

async function setupDevnet (config) {
  const devnet = new Devnet(config)
  devnet.ganache = new Ganache(config, {
    contractsBranch: config.contractsBranch
  })
  devnet.bor = new Bor(config, { repositoryBranch: config.borBranch })
  devnet.heimdall = new Heimdall(config, {
    repositoryBranch: config.heimdallBranch,
    dockerContext: config.heimdallDockerBuildContext
  })
  devnet.genesis = new Genesis(config, {
    repositoryBranch: config.genesisContractsBranch
  })

  const tasks = await devnet.getTasks()
  await tasks.run()
  console.log('%s Devnet is ready', chalk.green.bold('DONE'))
}

export async function getHosts (n) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'devnetHosts',
      message: 'Please enter comma separated hosts/IPs',
      validate: (input) => {
        const hosts = input.split(',').map((a) => {
          return a.trim().toLowerCase()
        })

        if (hosts.length === 0 || hosts.length !== n) {
          return `Enter valid ${n} hosts/IPs (comma separated)`
        }

        return true
      }
    }
  ])

  return answers.devnetHosts.split(',').map((a) => {
    return a.trim().toLowerCase()
  })
}

export async function getUsers (n) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'devnetUsers',
      message: 'Please enter comma separated Users',
      validate: (input) => {
        const hosts = input.split(',').map((a) => {
          return a.trim().toLowerCase()
        })

        if (hosts.length === 0 || hosts.length !== n) {
          return `Enter valid ${n} Users (comma separated)`
        }

        return true
      }
    }
  ])

  return answers.devnetHosts.split(',').map((a) => {
    return a.trim().toLowerCase()
  })
}

export default async function (command) {
  // configuration
  const config = await loadConfig({
    targetDirectory: command.parent.directory,
    fileName: command.parent.config,
    interactive: command.parent.interactive
  })
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

  if (!('ethHostUser' in config)) {
    questions.push({
      type: 'input',
      name: 'ethHostUser',
      message: 'Please enter ETH host',
      default: 'ubuntu'
    })
  }

  if (!('devnetType' in config)) {
    questions.push({
      type: 'list',
      name: 'devnetType',
      message: 'Please select devnet type',
      choices: ['docker', 'remote']
    })
  }

  if (!config.interactive) {
    errorMissingConfigs(
      questions.map((q) => {
        return q.name
      })
    )
  }

  answers = await inquirer.prompt(questions)
  config.set(answers)

  // set devent hosts
  let devnetBorHosts = config.devnetBorHosts || []
  let devnetBorUsers = config.devnetBorUsers || []
  let devnetHeimdallHosts = config.devnetHeimdallHosts || []
  let devnetHeimdallUsers = config.devnetHeimdallUsers || []
  const totalValidators = config.numOfValidators + config.numOfNonValidators

  // For docker, the devnetBorHosts conform to the subnet 172.20.1.0/24
  if (config.devnetType === 'docker') {
    devnetBorHosts = []
    devnetHeimdallHosts = []
    for (let i = 0; i < totalValidators; i++) {
      devnetBorHosts.push(`172.20.1.${i + 100}`)
      devnetHeimdallHosts.push(`heimdall${i}`)
    }
  } else {
    const missing = [
      'devnetBorHosts',
      'devnetBorUsers',
      'devnetHeimdallHosts',
      'devnetHeimdallUsers'
    ].filter((c) => {
      if (
        c in config &&
        config[c].length !== totalValidators &&
        !config.interactive
      ) {
        console.error(
          `Wrong number of hosts provided in ${c}, got ${config[c].length}, expect ${totalValidators}.`
        )
        process.exit(1)
      }
      return !(c in config) || config[c].length !== totalValidators
    })
    if (missing.length > 0) {
      const hosts = await getHosts(totalValidators)
      devnetBorHosts = hosts
      devnetHeimdallHosts = hosts
    }

    if (missing.length > 0) {
      const users = await getUsers(totalValidators)
      devnetBorUsers = users
      devnetHeimdallUsers = users
    }
  }
  config.set({
    devnetBorHosts,
    devnetBorUsers,
    devnetHeimdallHosts,
    devnetHeimdallUsers
  })

  // start setup
  await setupDevnet(config)
}
