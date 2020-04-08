import Listr from 'listr';
import execa from 'execa';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { isValidAddress } from 'ethereumjs-util'

import { cloneRepository } from '../../utils'
import { getChainIds } from '../helper'

// repository name
export const REPOSITORY_NAME = 'heimdall'
export const HEIMDALL_HOME = '.heimdalld'

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
  console.log(chalk.gray('Heimdall repo') + ': ' + chalk.bold.green(repoPath))
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
  return execa('./build/heimdalld', ['show-privatekey'], {
    cwd: repoPath,
  }).then(output => {
    try {
      return JSON.parse(output.stdout).priv_key
    } catch (e) {
      throw e
    }
  })
}

// returns heimdall tasks
export async function getHeimdallTasks(options = {}) {
  const repoPath = path.join(options.targetDirectory, REPOSITORY_NAME)
  const genesisFile = path.join(os.homedir(), HEIMDALL_HOME, 'config/genesis.json')

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
        title: 'Process genesis file',
        task: () => {
          return new Promise((resolve, reject) => {
            try {
              let data = fs.readFileSync(genesisFile, 'utf8');
              data = data.
                replace(/"chain_id":[ ]+".*"/gi, `"chain_id": "${options.heimdallChainId}"`).
                replace(/"bor_chain_id":[ ]+".*"/gi, `"bor_chain_id": "${options.borChainId}"`)
              fs.writeFileSync(genesisFile, data, { mode: 0o755 });
              resolve()
            } catch (e) {
              reject(e)
            }
          })
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
        })
      }
    ],
    {
      exitOnError: true,
    }
  );
}

async function setupHeimdall(options) {
  // get all heimdall related tasks
  const tasks = await getHeimdallTasks(options);

  await tasks.run();
  console.log('%s Heimdall is ready', chalk.green.bold('DONE'));

  // print details
  await printAccount(options)
  await printHeimdallPaths(options)

  return true;
}

export default async function () {
  // get answers
  const answers = await getChainIds()

  // options
  let options = {
    ...answers,
    targetDirectory: process.cwd(),
  };

  // start setup
  await setupHeimdall(options)
}