import Listr from 'listr';
import chalk from 'chalk';
import path from 'path';
import execa from 'execa';
import fs from 'fs-extra';
import ganache from 'ganache-cli';
import { projectInstall } from 'pkg-install';
import { toBuffer, privateToPublic, bufferToHex } from 'ethereumjs-util';

// get genesis related tasks
import { cloneRepository, getWalletFromPrivateKey } from '../../utils'
import { getChainIds, getKeystoreDetails, printDependencyInstructions } from '../helper'

// repository name
export const CONTRACTS_REPOSITORY_NAME = 'matic-contracts'
export const GANACHE_DB_PATH = 'ganache-db'
export const GANACHE_SERVER_PORT = 9545

function getDbPath(options = {}) {
  return path.join(options.targetDirectory, GANACHE_DB_PATH)
}

// print account details
export async function printAccountDetails(options = {}) {
  console.log(chalk.gray('Address') + ': ' + chalk.bold.green(options.genesisAddresses))
}

// print ganache db paths
export async function printGanacheDBPaths(options = {}) {
  console.log(chalk.gray('Ganache db path') + ': ' + chalk.bold.green(getDbPath(options)))
}

// stake and become validator
export async function getStakeTask(options = {}) {
  const maticContractPath = path.join(options.targetDirectory, CONTRACTS_REPOSITORY_NAME)

  // get public key
  options.publicKey = bufferToHex(privateToPublic(toBuffer(options.privateKey)))

  // stake
  return new Listr([
    {
      title: 'Stake',
      task: () => execa('bash', ['ganache-stake.sh', options.genesisAddresses[0], options.publicKey], {
        cwd: options.targetDirectory,
      })
    }
  ], {
    exitOnError: true,
  })
}

// start deployment
export async function getContractDeploymenTasks(options = {}) {
  const maticContractPath = path.join(options.targetDirectory, CONTRACTS_REPOSITORY_NAME)

  // server
  let server = null

  return new Listr([
    {
      title: 'Reset ganache',
      task: () => {
        return fs.remove(getDbPath(options))
      }
    },
    {
      title: 'Start ganache',
      task: () => {
        server = ganache.server({
          accounts: [{
            balance: '0xfffffffffffffffffffffffffffffffffffffffffffff',
            secretKey: options.privateKey
          }],
          port: GANACHE_SERVER_PORT,
          db_path: getDbPath(options),
          gasPrice: '0x1',
          gasLimit: '0xfffffffff',
        });

        return new Promise((resolve, reject) => {
          server.listen(GANACHE_SERVER_PORT, (err, blockchain) => {
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
      task: () => execa('bash', ['ganache-deployment.sh', options.privateKey, options.heimdallChainId], {
        cwd: options.targetDirectory,
      })
    },
    {
      title: 'Becoming validator',
      task: () => getStakeTask(options)
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

// get ganache tasks
export async function getGanacheTasks(options = {}) {
  const maticContractPath = path.join(options.targetDirectory, CONTRACTS_REPOSITORY_NAME)

  return new Listr(
    [
      {
        title: 'Clone matic contracts repository',
        task: () => cloneRepository(CONTRACTS_REPOSITORY_NAME, 'https://github.com/maticnetwork/contracts', options)
      },
      {
        title: 'Install dependencies for matic contracts',
        task: () => projectInstall({
          cwd: maticContractPath,
        })
      },
      {
        title: 'Process templates',
        task: () => execa('node', ['scripts/process-templates.js', '--bor-chain-id', options.borChainId], {
          cwd: maticContractPath,
        })
      },
      {
        title: 'Compile matic contracts',
        task: () => execa('npm', ['run', 'truffle:compile'], {
          cwd: maticContractPath,
        })
      },
      {
        title: 'Copy template scripts',
        task: () => {
          const templateDir = path.resolve(
            new URL(import.meta.url).pathname,
            '../templates'
          );

          return fs.copy(templateDir, options.targetDirectory)
        }
      },
      {
        title: 'Process template scripts',
        task: () => {
          // get public key
          options.publicKey = bufferToHex(privateToPublic(toBuffer(options.privateKey)))

          const startScriptFile = path.join(options.targetDirectory, 'ganache-start.sh')
          const deploymentScriptFile = path.join(options.targetDirectory, 'ganache-deployment.sh')
          const ganacheStakeFile = path.join(options.targetDirectory, 'ganache-stake.sh')

          let data = fs.readFileSync(startScriptFile, 'utf8')
          data = data.replace(/PRIVATE_KEY=.+/gi, `PRIVATE_KEY=${options.privateKey}`)
          fs.writeFileSync(startScriptFile, data, { mode: 0o755 })

          data = fs.readFileSync(deploymentScriptFile, 'utf8')
          data = data.replace(/PRIVATE_KEY=.+/gi, `PRIVATE_KEY=${options.privateKey}`).
            replace(/HEIMDALL_ID=.+/gi, `HEIMDALL_ID=${options.heimdallChainId}`)
          fs.writeFileSync(deploymentScriptFile, data, { mode: 0o755 })

          data = fs.readFileSync(ganacheStakeFile, 'utf8')
          data = data.replace(/ADDRESS=.+/gi, `ADDRESS=${options.genesisAddresses[0]}`).
            replace(/PUB_KEY=.+/gi, `PUB_KEY=${options.publicKey}`)
          fs.writeFileSync(ganacheStakeFile, data, { mode: 0o755 })
        }
      },
      {
        title: 'Deploy contracts',
        task: () => getContractDeploymenTasks(options) // get contact deployment tasks
      }
    ],
    {
      exitOnError: true,
    }
  );
}

async function setupGanache(options) {
  // get private key, keystore password and wallet
  const keystoreDetails = await getKeystoreDetails()
  options = Object.assign(options, keystoreDetails)

  // wallet
  const wallet = await getWalletFromPrivateKey(options.privateKey)

  // set genesis addresses
  options.genesisAddresses = [wallet.address]

  // get ganache tasks
  const tasks = await getGanacheTasks(options);

  await tasks.run();
  console.log('%s Ganache snapshot is ready', chalk.green.bold('DONE'));

  // print details
  await printAccountDetails(options)
  await printGanacheDBPaths(options)

  return true;
}

export default async function () {
  await printDependencyInstructions()

  // get answers
  const answers = await getChainIds()

  // options
  let options = {
    ...answers,
    targetDirectory: process.cwd(),
  };

  // start ganache
  await setupGanache(options)
}