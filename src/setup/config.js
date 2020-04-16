import inquirer from 'inquirer';
import fs from 'fs-extra';

const defaultConfigFileName = 'config.json'

export default class Config {
  constructor() { }

  toJSON() { }
}

export async function loadConfig(targetDirectory, configFileName) {
  const configFile = path.join(targetDirectory, configFileName || defaultConfigFileName)

  const hasConfigFile = await fs.exists(configFile)
  if (hasConfigFile) {
    const { override } = await inquirer.prompt({
      type: 'confirm',
      name: 'override',
      message: 'Configuration found in this directory. Do you want to override?'
    });

    if (override) {
      await fs.remove(configFile)
    } else {
      process.exit(0) // exit from the process
    }
  }

  // create new config
  const config = new Config()
  config.fileName = configFileName || defaultConfigFileName
  config.targetDirectory = targetDirectory
}

export async function saveConfig(config, targetDirectory) {
  const configFile = path.join(targetDirectory, config.fileName || defaultConfigFileName)
  const data = JSON.stringify(config.toJSON(), null, 2)
  return fs.writeFileSync(configFile, data, { mode: 0o755 })
}