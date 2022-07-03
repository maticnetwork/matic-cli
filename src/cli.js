import { program } from "commander";

import pkg from "../package.json";
import setupPrograms from "./setup";

const setupCmd = program
  .version(pkg.version)
  .command("setup")
  .option("-i, --interactive", "enable interactive setup")
  .option("-c, --config [string]", "path to configuration file", "config.json")
  .option(
    "-d, --directory [string]",
    "path to target output directory",
    process.cwd()
  );

// add all setup programs as sub commands
setupPrograms.forEach((p) => {
  setupCmd.addCommand(p);
});

// start CLI
export async function cli(args) {
  program.parse(args);
}
