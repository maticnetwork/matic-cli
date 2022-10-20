import Listr from "listr";
import execa from "execa";
import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import os from "os";

import fileReplacer from "../../lib/file-replacer";
import {loadConfig} from "../config";
import {cloneRepository, compressedPublicKey, privateKeyToPublicKey, processTemplateFiles,} from "../../lib/utils";
import {getDefaultBranch, printDependencyInstructions} from "../helper";
import {Ganache} from "../ganache";
import {getRemoteStdio} from "../../express/common/remote-worker";

// repository name
export const REPOSITORY_NAME = "heimdall";
export const HEIMDALL_HOME = ".heimdalld";

export function getValidatorKeyPath() {
    return path.join(
        os.homedir(),
        HEIMDALL_HOME,
        "config/priv_validator_key.json"
    );
}

export class Heimdall {
    constructor(config, options = {}) {
        this.config = config;

        this.repositoryName = this.name
        this.repositoryBranch = options.repositoryBranch || 'develop'
        this.repositoryUrl = options.repositoryUrl || 'https://github.com/maticnetwork/heimdall'
        this.dockerContext = options.dockerContext || "https://github.com/maticnetwork/heimdall.git#develop"
    }

    get name() {
        return "heimdall";
    }

    get taskTitle() {
        return "Setup heimdall";
    }

    get validatorKeyFile() {
        return "priv_validator_key.json";
    }

    get configValidatorKeyFilePath() {
        return path.join(this.config.configDir, this.validatorKeyFile);
    }

    get repositoryDir() {
        if (this.dockerContext !== undefined && !this.dockerContext.startsWith("http")) {
            return this.dockerContext
        } else {
            return path.join(this.config.codeDir, this.repositoryName)
        }
    }

    get buildDir() {
        return path.join(this.repositoryDir, "build");
    }

    get heimdalldCmd() {
        return path.join(this.buildDir, "heimdalld");
    }

    get heimdallDataDir() {
        return path.join(this.config.dataDir, this.name);
    }

    get heimdallConfigDir() {
        return path.join(this.heimdallDataDir, "config");
    }

    get heimdallGenesisFilePath() {
        return path.join(this.heimdallConfigDir, "genesis.json");
    }

    get heimdallHeimdallConfigFilePath() {
        return path.join(this.heimdallConfigDir, "heimdall-config.toml");
    }

    get heimdallConfigFilePath() {
        return path.join(this.heimdallConfigDir, "config.toml");
    }

    get heimdallValidatorKeyFilePath() {
        return path.join(this.heimdallConfigDir, this.validatorKeyFile);
    }

    async print() {
        // print details
        console.log(
            chalk.gray("Heimdall home") +
            ": " +
            chalk.bold.green(this.heimdallDataDir)
        );
        console.log(
            chalk.gray("Heimdall genesis") +
            ": " +
            chalk.bold.green(this.heimdallGenesisFilePath)
        );
        console.log(
            chalk.gray("Heimdall validator key") +
            ": " +
            chalk.bold.green(this.heimdallValidatorKeyFilePath)
        );
        console.log(
            chalk.gray("Heimdall repo") + ": " + chalk.bold.green(this.repositoryDir)
        );
        console.log(
            chalk.gray("Setup heimdall") +
            ": " +
            chalk.bold.green("bash heimdall-start.sh")
        );
        console.log(
            chalk.gray("Reset heimdall") +
            ": " +
            chalk.bold.green("bash heimdall-clean.sh")
        );
    }

    async account() {
        return execa(
            this.heimdalldCmd,
            ["show-account", "--home", this.heimdallDataDir],
            {
                cwd: this.config.targetDirectory,
                stdio: getRemoteStdio(),
            }
        ).then((output) => {
            return JSON.parse(output.stdout);
        });
    }

    // returns heimdall private key details
    async accountPrivateKey() {
        return execa(
            this.heimdalldCmd,
            ["show-privatekey", "--home", this.heimdallDataDir],
            {
                cwd: this.config.targetDirectory,
                stdio: getRemoteStdio(),
            }
        ).then((output) => {
            return JSON.parse(output.stdout).priv_key;
        });
    }

    // returns content of validator key
    async generateValidatorKey() {
        return execa(
            this.heimdalldCmd,
            [
                "generate-validatorkey",
                this.config.primaryAccount.privateKey,
                "--home",
                this.heimdallDataDir,
            ],
            {
                cwd: this.config.configDir,
                stdio: getRemoteStdio(),
            }
        ).then(() => {
            return require(this.configValidatorKeyFilePath);
        });
    }

    async getProcessGenesisFileTasks() {
        return new Listr(
            [
                {
                    title: "Process Heimdall and Bor chain ids",
                    task: () => {
                        fileReplacer(this.heimdallGenesisFilePath)
                            .replace(
                                /"chain_id":[ ]*".*"/gi,
                                `"chain_id": "${this.config.heimdallChainId}"`
                            )
                            .replace(
                                /"bor_chain_id":[ ]*".*"/gi,
                                `"bor_chain_id": "${this.config.borChainId}"`
                            )
                            .save();
                    },
                },
                {
                    title: "Process validators",
                    task: () => {
                        fileReplacer(this.heimdallGenesisFilePath)
                            .replace(
                                /"address":[ ]*".*"/gi,
                                `"address": "${this.config.primaryAccount.address}"`
                            )
                            .replace(
                                /"signer":[ ]*".*"/gi,
                                `"signer": "${this.config.primaryAccount.address}"`
                            )
                            .replace(
                                /"pub_key":[ ]*".*"/gi,
                                `"pub_key": "${compressedPublicKey(
                                    privateKeyToPublicKey(
                                        this.config.primaryAccount.privateKey
                                    ).replace("0x", "0x04")
                                )}"`
                            )
                            .replace(
                                /"power":[ ]*".*"/gi,
                                `"power": "${this.config.defaultStake}"`
                            )
                            .replace(
                                /"user":[ ]*".*"/gi,
                                `"user": "${this.config.primaryAccount.address}"`
                            )
                            .save();
                    },
                },
                {
                    title: "Process contract addresses",
                    task: () => {
                        // get root contracts
                        const rootContracts = this.config.contractAddresses.root;

                        fileReplacer(this.heimdallGenesisFilePath)
                            .replace(
                                /"matic_token_address":[ ]*".*"/gi,
                                `"matic_token_address": "${rootContracts.tokens.TestToken}"`
                            )
                            .replace(
                                /"staking_manager_address":[ ]*".*"/gi,
                                `"staking_manager_address": "${rootContracts.StakeManagerProxy}"`
                            )
                            .replace(
                                /"root_chain_address":[ ]*".*"/gi,
                                `"root_chain_address": "${rootContracts.RootChainProxy}"`
                            )
                            .replace(
                                /"staking_info_address":[ ]*".*"/gi,
                                `"staking_info_address": "${rootContracts.StakingInfo}"`
                            )
                            .replace(
                                /"state_sender_address":[ ]*".*"/gi,
                                `"state_sender_address": "${rootContracts.StateSender}"`
                            )
                            .save();
                    },
                    enabled: () => {
                        return this.config.contractAddresses;
                    },
                },
            ],
            {
                exitOnError: true,
            }
        );
    }

    cloneRepositoryTask() {
        return {
            title: "Clone Heimdall repository",
            task: () =>
                cloneRepository(
                    this.repositoryName,
                    this.repositoryBranch,
                    this.repositoryUrl,
                    this.config.codeDir
                ),
        };
    }

  buildTask() {
    return {
      title: 'Build Heimdall',
      task: () => execa('make', ['build'], {
        cwd: this.repositoryDir
      })
    }
  }

    async getTasks() {
        return new Listr(
            [
                this.cloneRepositoryTask(),
                this.buildTask(),
                {
                    title: "Init Heimdall",
                    task: () => {
                        return execa(
                            this.heimdalldCmd,
                            [
                                "init",
                                "--home",
                                this.heimdallDataDir,
                                "--chain-id",
                                this.heimdallChainId,
                                "heimdall-test",
                            ],
                            {
                                cwd: this.repositoryDir,
                                stdio: getRemoteStdio(),
                            }
                        );
                    },
                },
                {
                    title: "Create Heimdall account from private key",
                    task: () => {
                        // It generates new account for validator
                        // and replaces it with new validator key
                        return this.generateValidatorKey().then((data) => {
                            return fs.writeFile(
                                this.heimdallValidatorKeyFilePath,
                                JSON.stringify(data, null, 2),
                                {mode: 0o755}
                            );
                        });
                    },
                },
                {
                    title: "Process genesis file",
                    task: () => {
                        return this.getProcessGenesisFileTasks();
                    },
                },
                {
                    title: "Process heimdall config file",
                    task: () => {
                        fileReplacer(this.heimdallHeimdallConfigFilePath)
                            .replace(
                                /eth_rpc_url[ ]*=[ ]*".*"/gi,
                                'eth_rpc_url = "http://localhost:9545"'
                            )
                            .replace(
                                /bor_rpc_url[ ]*=[ ]*".*"/gi,
                                'bor_rpc_url = "http://localhost:8545"'
                            )
                            .save();
                    },
                },
                {
                    title: "Copy template scripts",
                    task: async () => {
                        const templateDir = path.resolve(
                            new URL(import.meta.url).pathname,
                            "../templates"
                        );

                        // copy all templates to target directory
                        await fs.copy(templateDir, this.config.targetDirectory);

                        // process all njk templates
                        await processTemplateFiles(this.config.targetDirectory, {
                            obj: this,
                        });
                    },
                },
            ],
            {
                exitOnError: true,
            }
        );
    }
}

async function setupHeimdall(config) {
    const ganache = new Ganache(config, {contractsBranch: config.contractsBranch})
    const heimdall = new Heimdall(config, {
        repositoryBranch: config.heimdallBranch,
        dockerContext: config.heimdallDockerBuildContext
    })

    // get all heimdall related tasks
    const tasks = new Listr(
        [
            {
                title: ganache.taskTitle,
                task: () => {
                    return ganache.getTasks();
                },
            },
            {
                title: heimdall.taskTitle,
                task: () => {
                    return heimdall.getTasks();
                },
            },
        ],
        {
            exitOnError: true,
        }
    );

    await tasks.run();
    console.log("%s Heimdall is ready", chalk.green.bold("DONE"));

    // print details
    await config.print();
    await ganache.print();
    await heimdall.print();

    return true;
}

export default async function (command) {
    await printDependencyInstructions();

    // configuration
    await loadConfig({
        targetDirectory: command.parent.directory,
        fileName: command.parent.config,
        interactive: command.parent.interactive,
    });
    await config.loadChainIds();
    await config.loadAccounts();

    // load branch
    const answers = await getDefaultBranch(config);
    config.set(answers);

    // start setup
    await setupHeimdall(config);
}
