import fs from "fs-extra";
import path from "path";
import execa from "execa";
import chalk from "chalk";
import YAML from "yaml";

import {getChainIds, getKeystoreDetails, getNetworkParams} from "./helper";
import {getAccountFromPrivateKey} from "../lib/utils";
import {getRemoteStdio} from "../express/common/remote-worker";

const defaultConfigFileName = "config.json";

export default class Config {
  constructor(options = {}) {
    if (!options.fileName || !options.targetDirectory) {
      throw new Error("Filename and target directory needed");
    }

    options.codeDirectory = options.codeDirectory || "code";
    options.dataDirectory = options.dataDirectory || "data";
    options.configDirectory = options.configDirectory || "config";

    options.defaultStake = options.defaultStake || 10000;
    options.defaultFee = options.defaultFee || 2000;
    options.accounts = [];

    // assign all prop to obj
    this.set(options);
  }

  set(options = {}) {
    for (const prop in options) {
      if (options.hasOwnProperty(prop)) {
        Object.defineProperty(this, prop, {
          value: options[prop],
          writable: true,
          enumerable: true,
        });
      }
    }
  }

  get configFilePath() {
    return path.join(this.targetDirectory, this.fileName);
  }

  get codeDir() {
    return path.join(this.targetDirectory, this.codeDirectory);
  }

  get dataDir() {
    return path.join(this.targetDirectory, this.dataDirectory);
  }

  get configDir() {
    return path.join(this.targetDirectory, this.configDirectory);
  }

  get primaryAccount() {
    return this.accounts[0];
  }

  async loadChainIds() {
    const answers = await getChainIds(this);
    this.set(answers);
  }

  async loadNetworkParams() {
    const answer = await getNetworkParams(this)
    this.set(answer)
  }

  async forceAskAccount() {
    this.set({ forceAsk: true });
  }

  async loadAccounts() {
    if (!this.privateKey || !this.keystorePassword) {
      const keystoreDetails = await getKeystoreDetails(this);
      this.accounts.push(getAccountFromPrivateKey(keystoreDetails.privateKey));
      this.set({ keystorePassword: keystoreDetails.keystorePassword });
    }

    // set genesis address
    this.genesisAddresses = [this.primaryAccount.address];
  }

  async saveConfig() {
    await saveConfig(this);
  }

  print() {
    console.log(
      chalk.gray("Config json file") +
      ": " +
      chalk.bold.green(this.configFilePath)
    );
    console.log(
      chalk.gray("Code directory") + ": " + chalk.bold.green(this.codeDir)
    );
    console.log(
      chalk.gray("Data directory") + ": " + chalk.bold.green(this.dataDir)
    );
    console.log(
      chalk.gray("Address") +
      ": " +
      chalk.bold.green(this.primaryAccount.address)
    );
    console.log(
      chalk.gray("Bor Chain ID") + ": " + chalk.bold.green(this.borChainId)
    );
    console.log(
      chalk.gray("Heimdall Chain ID") +
      ": " +
      chalk.bold.green(this.heimdallChainId)
    );
  }
}

export async function loadConfig(options = {}) {
  let { targetDirectory, fileName } = options;
  targetDirectory = targetDirectory || process.cwd();
  fileName = fileName || defaultConfigFileName;

  // get config file path
  const configFile = path.join(targetDirectory, fileName);

  const hasConfigFile = await fs.exists(configFile);
  let _options = {};
  if (hasConfigFile) {
    if (configFile.endsWith(".json")) {
      _options = require(configFile); // get options from config
    } else if (configFile.endsWith(".yaml") || configFile.endsWith(".yml")) {
      const file = fs.readFileSync(configFile, "utf8");
      _options = YAML.parse(file);
    } else {
      console.error("Unable to recognize file format for file: ", configFile);
      process.exit(1);
    }
    options = {
      ...options,
      ..._options,
    };
  }

  const config = new Config({
    fileName: fileName,
    targetDirectory: targetDirectory,
    ...options,
  });

  await execa(
    "mkdir",
    ["-p", config.configDir, config.dataDir, config.configDir],
    {
      cwd: config.targetDirectory,
      stdio: getRemoteStdio(),
    }
  );

  return config;
}

export async function saveConfig(config) {
  const configFile = path.join(
    config.targetDirectory,
    config.fileName || defaultConfigFileName
  );
  let data = {};
  if (configFile.endsWith(".json")) {
    data = JSON.stringify(config, null, 2);
  } else if (configFile.endsWith(".yml") || configFile.endsWith(".yaml")) {
    data = YAML.stringify(config);
  } else {
    console.error("Unable to recognize file format for file: ", configFile);
    process.exit(1);
  }
  return fs.writeFileSync(configFile, data, { mode: 0o755 });
}
