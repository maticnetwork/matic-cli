import Listr from 'listr';
import chalk from 'chalk';

// get genesis related tasks
import { getGenesisContractTasks, printGenesisPath } from '../genesis'
import { getHeimdallTasks, printHeimdallPaths, printAccount } from '../heimdall'
import { getGanacheTasks, printGanacheDBPaths } from '../ganache'
import { getBorTasks, printBorDetails } from '../bor'
import { getChainIds, getKeystoreDetails, printDependencyInstructions } from '../helper'
import { getWalletFromPrivateKey } from '../../utils'

async function setupLocalnet(options) {
  const tasks = new Listr(
    [
      {
        title: 'Setup contracts',
        task: () => {
          return getGanacheTasks(options)
        }
      },
      {
        title: 'Setup Heimdall',
        task: () => {
          return getHeimdallTasks(options)
        }
      },
      {
        title: 'Setup Genesis contracts',
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
  console.log('%s Localnet ready', chalk.green.bold('DONE'));

  // print details
  await printAccount(options)
  await printGanacheDBPaths(options)
  await printHeimdallPaths(options)
  await printGenesisPath(options)
  await printBorDetails(options)

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
  await setupLocalnet(options)
}