import Listr from 'listr';
import execa from 'execa';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs';
import { projectInstall } from 'pkg-install';
import { isValidAddress } from 'ethereumjs-util'

import { cloneRepository } from '../../utils'
import { getChainIds } from '../helper'
import { exec } from 'child_process';

// repostiory name
const REPOSITORY_NAME = 'genesis-contracts'

// default stake and balance
const DEFAULT_STAKE = 10
const DEFAULT_BALANCE = 1000

// print genesis path
export async function printGenesisPath(options = {}) {
  const repoPath = path.join(options.targetDirectory, REPOSITORY_NAME)
  const genesisPath = path.join(repoPath, 'genesis.json')
  // print details
  console.log(chalk.gray('Bor genesis path') + ': ' + chalk.bold.green(genesisPath))
}

// get genesis addresses
export async function getGenesisAddresses() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'genesisAddresses',
      message: 'Please enter comma separated validator addresses',
      default: '0x6c468CF8c9879006E22EC4029696E005C2319C9D',
      validate: (input) => {
        const addrs = input.split(",").map(a => {
          return a.trim().toLowerCase();
        }).filter(a => {
          return isValidAddress(a)
        })

        // check if addrs has any valid address
        if (addrs.length === 0) {
          return "Enter valid addresses (comma separated)"
        }

        return true
      }
    }
  ])

  // set genesis addresses
  return answers.genesisAddresses.split(",").map(a => {
    return a.trim().toLowerCase();
  });
}

// get genesis contact tasks
export async function getGenesisContractTasks(options) {
  const repoPath = path.join(options.targetDirectory, REPOSITORY_NAME)
  const maticContractPath = path.join(options.targetDirectory, REPOSITORY_NAME, 'matic-contracts')

  return new Listr(
    [
      {
        title: 'Clone genesis-contracts repository',
        task: () => cloneRepository(REPOSITORY_NAME, 'https://github.com/maticnetwork/genesis-contracts', options)
      },
      {
        title: 'Install dependencies for genesis-contracts',
        task: () => projectInstall({
          cwd: repoPath,
        })
      },
      {
        title: 'Setting up sub-modules',
        task: () => execa('git', ['submodule', 'init'], {
          cwd: repoPath,
        })
      },
      {
        title: 'Update sub-modules',
        task: () => execa('git', ['submodule', 'update'], {
          cwd: repoPath,
        })
      },
      {
        title: 'Install dependencies for matic-contracts',
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
        title: 'Compile matic-contracts',
        task: () => execa('npm', ['run', 'truffle:compile'], {
          cwd: maticContractPath,
        })
      },
      {
        title: 'Prepare validators for genesis file',
        task: () => {
          const validators = options.genesisAddresses.map(a => {
            return {
              address: a,
              stake: DEFAULT_STAKE,     // without 10^18
              balance: DEFAULT_BALANCE  // without 10^18
            }
          })

          return Promise.resolve().then(() => {
            // check if validators js exists
            if (!fs.existsSync('validators.js')) {
              return
            }

            // take validator js backup
            return execa('mv', ['validators.js', 'validators.js.backup'], {
              cwd: repoPath,
            })
          }).then(() => {
            fs.writeFileSync(path.join(repoPath, 'validators.json'), JSON.stringify(validators, null, 2), 'utf8');
          })
        }
      },
      {
        title: 'Generate Bor validator set',
        task: () => execa('node', [
          'generate-borvalidatorset.js', '--bor-chain-id', options.borChainId, '--heimdall-chain-id', options.heimdallChainId
        ], {
          cwd: repoPath,
        })
      },
      {
        title: 'Generate genesis.json',
        task: () => execa('node', [
          'generate-genesis.js', '--bor-chain-id', options.borChainId, '--heimdall-chain-id', options.heimdallChainId
        ], {
          cwd: repoPath,
        })
      }
    ],
    {
      exitOnError: true,
    }
  );
}

async function setupGenesis(options) {
  // load genesis addresses
  options.genesisAddresses = await getGenesisAddresses()

  // get all genesis related tasks
  const tasks = await getGenesisContractTasks(options);

  // run all tasks
  await tasks.run();
  console.log('%s Genesis file is ready', chalk.green.bold('DONE'));

  // print genesis path
  await printGenesisPath(options)
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
  await setupGenesis(options)
}