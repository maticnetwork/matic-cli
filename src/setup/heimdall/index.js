import Listr from 'listr';
import execa from 'execa';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { isValidAddress } from 'ethereumjs-util'

import { cloneRepository, getWalletFromPrivateKey } from '../../utils'
import { getChainIds, getKeystoreDetails, printDependencyInstructions } from '../helper'
import { getGanacheTasks, printGanacheDBPaths } from '../ganache';


// repository name
export const REPOSITORY_NAME = 'heimdall'
export const HEIMDALL_HOME = '.heimdalld'

export function getValidatorKeyPath() {
  return path.join(os.homedir(), HEIMDALL_HOME, 'config/priv_validator_key.json')
}

// print account details
export async function printAccount(options = {}) {
  // print details
  const account = await getAccount(options)
  Object.keys(account).forEach((k) => {
    console.log(chalk.gray(k) + ': ' + chalk.bold.green(account[k]))
  })
}

// print heidmall path
export async function printHeimdallPaths(options = {}) {
  const repoPath = path.join(options.targetDirectory, REPOSITORY_NAME)
  const heimdallHomePath = path.join(os.homedir(), HEIMDALL_HOME)
  const heimdallGenesisPath = path.join(os.homedir(), HEIMDALL_HOME, 'config/genesis.json')

  // print details
  console.log(chalk.gray('Heimdall home') + ': ' + chalk.bold.green(heimdallHomePath))
  console.log(chalk.gray('Heimdall genesis') + ': ' + chalk.bold.green(heimdallGenesisPath))
  console.log(chalk.gray('Heimdall validator key') + ': ' + chalk.bold.green(getValidatorKeyPath()))
  console.log(chalk.gray('Heimdall repo') + ': ' + chalk.bold.green(repoPath))
  console.log(chalk.gray('Run Heimdall') + ': ' + chalk.bold.green(`cd ${REPOSITORY_NAME} && make run-heimdall`))
  console.log(chalk.gray('Run Heimdall rest server') + ': ' + chalk.bold.green(`cd ${REPOSITORY_NAME} && make run-server`))
  console.log(chalk.gray('Run Heimdall bridge') + ': ' + chalk.bold.green(`cd ${REPOSITORY_NAME} && make run-bridge`))
  console.log(chalk.gray('Clean Heimdall data') + ': ' + chalk.bold.green(`cd ${REPOSITORY_NAME} && make reset-heimdall`))
}

// returns heimdall account details
export async function getAccount(options = {}) {
  const repoPath = path.join(options.targetDirectory, REPOSITORY_NAME)
  return execa('./build/heimdalld', ['show-account'], {
    cwd: repoPath,
  }).then(output => {
    try {
      return JSON.parse(output.stdout)
    } catch (e) {
      throw e
    }
  })
}

// returns heimdall private key details
export async function getAccountPrivateKey(options = {}) {
  const repoPath = path.join(options.targetDirectory, REPOSITORY_NAME)
  const cmd = path.join(options.targetDirectory, REPOSITORY_NAME, 'build/heimdalld')
  return execa(cmd, ['show-privatekey'], {
    cwd: repoPath,
  }).then(output => {
    try {
      return JSON.parse(output.stdout).priv_key
    } catch (e) {
      throw e
    }
  })
}

// returns content of validator key
export async function getGenerateValidatorKey(options = {}) {
  const cmd = path.join(options.targetDirectory, REPOSITORY_NAME, 'build/heimdallcli')
  const validatorKeyFile = path.join(options.targetDirectory, 'priv_validator_key.json')
  return execa(cmd, ['generate-validatorkey', options.privateKey], {
    cwd: options.targetDirectory,
  }).then(() => {
    return require(validatorKeyFile)
  })
}

// process genesis file tasks
export async function getProcessGenesisFileTasks(options = {}) {
  const genesisFile = path.join(os.homedir(), HEIMDALL_HOME, 'config/genesis.json')

  return new Listr([
    {
      title: 'Process Heimdall and Bor chain ids',
      task: () => fs.readFile(genesisFile, 'utf8').then(data => {
        return data.
          replace(/"chain_id":[ ]+".*"/gi, `"chain_id": "${options.heimdallChainId}"`).
          replace(/"bor_chain_id":[ ]+".*"/gi, `"bor_chain_id": "${options.borChainId}"`)
      }).then(data => {
        return fs.writeFile(genesisFile, data, { mode: 0o755 });
      }),
      enabled: () => {
        return options.heimdallChainId && options.borChainId
      }
    },
    {
      title: 'Process contract addresses',
      task: () => fs.readFile(genesisFile, 'utf8').then(data => {
        return data.
          replace(/"matic_token_address":[ ]+".*"/gi, `"matic_token_address": "${options.contractAddresses.root.tokens.TestToken}"`).
          replace(/"staking_manager_address":[ ]+".*"/gi, `"staking_manager_address": "${options.contractAddresses.root.StakeManagerProxy}"`).
          replace(/"root_chain_address":[ ]+".*"/gi, `"root_chain_address": "${options.contractAddresses.root.RootChainProxy}"`).
          replace(/"staking_info_address":[ ]+".*"/gi, `"staking_info_address": "${options.contractAddresses.root.StakingInfo}"`).
          replace(/"state_sender_address":[ ]+".*"/gi, `"state_sender_address": "${options.contractAddresses.root.StateSender}"`)
      }).then(data => {
        return fs.writeFile(genesisFile, data, { mode: 0o755 });
      }),
      enabled: () => {
        return options.contractAddresses
      }
    }
  ], {
    exitOnError: true,
  })
}

// returns heimdall tasks
export async function getHeimdallTasks(options = {}) {
  const repoPath = path.join(options.targetDirectory, REPOSITORY_NAME)

  return new Listr(
    [
      {
        title: 'Clone Heimdall repository',
        task: () => cloneRepository(REPOSITORY_NAME, 'https://github.com/maticnetwork/heimdall', options)
      },
      {
        title: 'Build Heimdall',
        task: () => execa('make', ['build'], {
          cwd: repoPath,
        })
      },
      {
        title: 'Init Heimdall',
        task: () => execa('make', ['init-heimdall'], {
          cwd: repoPath,
        })
      },
      {
        title: 'Create Heimdall account from private key',
        task: () => {
          return getGenerateValidatorKey(options).then(data => {
            return fs.writeFile(getValidatorKeyPath(), JSON.stringify(data, null, 2), { mode: 0o755 })
          })
        },
        enabled: () => {
          return options.privateKey
        }
      },
      {
        title: 'Process genesis file',
        task: () => {
          return getProcessGenesisFileTasks(options)
        }
      },
      {
        title: 'Load account details',
        task: () => getAccount(options).then(account => {
          const address = account.address
          if (!isValidAddress(address)) {
            throw new Error("Invalid validator address")
          }

          // store address
          options.genesisAddresses = options.genesisAddresses || []
          options.genesisAddresses.push(address)
        })
      },
      {
        title: 'Load private key details',
        task: () => getAccountPrivateKey(options).then(pk => {
          // store private key
          options.privateKey = pk
        }),
        enabled: () => {
          return !options.privateKey
        }
      }
    ],
    {
      exitOnError: true,
    }
  );
}

async function setupHeimdall(options) {
  // get all heimdall related tasks
  const tasks = new Listr([
    // {
    //   title: 'Setup contracts',
    //   task: () => {
    //     return getGanacheTasks(options)
    //   }
    // },
    {
      title: 'Setup Heimdall',
      task: () => {
        return getHeimdallTasks(options)
      }
    }
  ], {
    exitOnError: true,
  })

  await tasks.run();
  console.log('%s Heimdall is ready', chalk.green.bold('DONE'));

  // print details
  await printAccount(options)
  await printGanacheDBPaths(options)
  await printHeimdallPaths(options)

  return true;
}

export default async function () {
  await printDependencyInstructions()

  // options
  let options = {
    targetDirectory: process.cwd(),
  };

  // get answers
  const answers = await getChainIds(options)
  options = Object.assign(options, answers)

  // get private key, keystore password and wallet
  const keystoreDetails = await getKeystoreDetails()
  options = Object.assign(options, keystoreDetails)

  // wallet
  const wallet = await getWalletFromPrivateKey(options.privateKey)

  // set genesis addresses
  options.genesisAddresses = [wallet.address]

  // start setup
  await setupHeimdall(options)
}