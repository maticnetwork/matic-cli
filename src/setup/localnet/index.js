import Listr from 'listr';
import chalk from 'chalk';

// get genesis related tasks
import { getGenesisContractTasks, printGenesisPath } from '../genesis'
import { getHeimdallTasks, printHeimdallPaths, printAccount } from '../heimdall'
import { getBorTasks, printBorDetails } from '../bor'
import { getChainIds } from '../helper'

async function setupLocalnet(options) {
  const tasks = new Listr(
    [
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
  await printHeimdallPaths(options)
  await printGenesisPath(options)
  await printBorDetails(options)

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
  await setupLocalnet(options)
}