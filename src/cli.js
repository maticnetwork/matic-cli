import { program, Command } from 'commander';

import pkg from '../package.json';
import setupPrograms from './setup';

const setupCmd = program.
  version(pkg.version).
  command("setup")

// add all setup programs as sub commands
setupPrograms.forEach((p) => {
  setupCmd.addCommand(p)
})

// start CLI
export async function cli(args) {
  program.parse(args);
}
