import Listr from 'listr';
import execa from 'execa';
import chalk from 'chalk';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';

import { cloneRepository, getKeystoreFile, getWalletFromPrivateKey } from '../../utils'
import { getChainIds, getKeystoreDetails, printDependencyInstructions } from '../helper'
import { getGenesisContractTasks, printGenesisPath } from '../genesis'

// repository name
export const REPOSITORY_NAME = 'bor'
export const BOR_NAME = REPOSITORY_NAME
export const BOR_DATA_NAME = 'data'
export const KEYSTORE_PASSWORD = 'hello'

// print bor details
export async function printBorDetails(options = {}) {
  const repoPath = path.join(options.targetDirectory, REPOSITORY_NAME)
  const borHomePath = path.join(os.homedir(), BOR_DATA_NAME, BOR_NAME)

  // print details
  console.log(chalk.gray('Bor home') + ': ' + chalk.bold.green(borHomePath))
  console.log(chalk.gray('Bor repo') + ': ' + chalk.bold.green(repoPath))
  console.log(chalk.gray('Setup bor chain') + ': ' + chalk.bold.green("bash bor-setup.sh"))
  console.log(chalk.gray('Start bor chain') + ': ' + chalk.bold.green("bash bor-start.sh"))
  console.log(chalk.gray('Clean bor chain') + ': ' + chalk.bold.green("bash bor-clean.sh"))
}

// print account details
export async function printAccountDetails(options = {}) {
  console.log(chalk.gray('Address') + ': ' + chalk.bold.green(options.genesisAddresses))
}

// returns bor tasks
export async function getBorTasks(options = {}) {
  const repoPath = path.join(options.targetDirectory, REPOSITORY_NAME)
  const dataDir = path.join(options.targetDirectory, BOR_DATA_NAME)
  const borDataDir = path.join(options.targetDirectory, BOR_DATA_NAME, BOR_NAME)
  const keystoreDir = path.join(dataDir, 'keystore')
  const keystorePassword = options.keystorePassword || KEYSTORE_PASSWORD

  return new Listr(
    [
      {
        title: 'Clone Bor repository',
        task: () => cloneRepository(REPOSITORY_NAME, 'https://github.com/maticnetwork/bor', options)
      },
      {
        title: 'Build Bor',
        task: () => execa('make', ['bor'], {
          cwd: repoPath,
        })
      },
      {
        title: 'Prepare data directory',
        task: () => {
          return execa('mkdir', ['-p', dataDir, borDataDir, keystoreDir], {
            cwd: options.targetDirectory,
          })
        }
      },
      {
        title: 'Prepare keystore and password.txt',
        task: () => {
          // get keystore file and store on options
          const keystoreFileObj = getKeystoreFile(options.privateKey, keystorePassword)

          const p = [
            fs.writeFile(path.join(dataDir, 'password.txt'), `${keystorePassword}\n`),
            fs.writeFile(path.join(keystoreDir, keystoreFileObj.keystoreFilename), JSON.stringify(keystoreFileObj.keystore, null, 2))
          ]
          return Promise.all(p)
        }
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
          const startScriptFile = path.join(options.targetDirectory, 'bor-start.sh')
          return fs.readFile(startScriptFile, 'utf8').then(data => {
            return data.
              replace(/ADDRESS=.+/gi, `ADDRESS=${options.genesisAddresses[0]}`).
              replace(/BOR_CHAIN_ID=.+/gi, `BOR_CHAIN_ID=${options.borChainId}`)
          }).then(data => {
            return fs.writeFile(startScriptFile, data, { mode: 0o755 });
          })
        }
      }
    ],
    {
      exitOnError: true,
    }
  );
}

async function setupBor(options) {
  // get private key, keystore password and wallet
  const keystoreDetails = await getKeystoreDetails()
  options = Object.assign(options, keystoreDetails)

  // wallet
  const wallet = await getWalletFromPrivateKey(options.privateKey)

  // set genesis addresses
  options.genesisAddresses = [wallet.address]

  const tasks = new Listr(
    [
      {
        title: 'Setup genesis-contracts',
        task: () => {
          return getGenesisContractTasks(options)
        }
      },
      {
        title: 'Setup Bor',
        task: () => {
          return getBorTasks(options)
        }
      }
    ],
    {
      exitOnError: true,
    }
  );

  await tasks.run();
  console.log('%s Bor is ready', chalk.green.bold('DONE'));

  // print details
  await printAccountDetails(options)
  await printGenesisPath(options)
  await printBorDetails(options)

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

  // start setup
  await setupBor(options)
}