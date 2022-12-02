import Listr from "listr";
import chalk from "chalk";
import path from "path";
import execa from "execa";
import fs from "fs-extra";
import ganache from "ganache";

import {loadConfig} from "../config";
import {processTemplateFiles} from "../../lib/utils";
import {getDefaultBranch, printDependencyInstructions} from "../helper";
import {Contracts} from "../contracts";
import {getRemoteStdio} from "../../express/common/remote-worker";

export class Ganache {
    constructor(config, options = {}) {
        this.config = config;

        this.dbName = options.dbName || "ganache-db";
        this.serverPort = options.serverPort || 9545;

        // get contracts setup obj
        this.contracts = new Contracts(config, {
            repositoryBranch: options.contractsBranch,
        });
    }

    get name() {
        return "ganache";
    }

    get taskTitle() {
        return "Setup contracts on Ganache";
    }

    get dbDir() {
        return path.join(this.config.dataDir, this.dbName);
    }

    get dbDirRemote() {
        return path.join("./data", this.dbName);
    }

    async print() {
        console.log(
            chalk.gray("Ganache db path") + ": " + chalk.bold.green(this.dbDir)
        );
    }

    async getStakeTasks() {
        // stake
        return new Listr(
            [
                {
                    title: "Stake",
                    task: () =>
                        execa("bash", ["ganache-stake.sh"], {
                            cwd: this.config.targetDirectory,
                            stdio: getRemoteStdio(),
                        }),
                },
            ],
            {
                exitOnError: true,
            }
        );
    }

    async getContractDeploymentTasks() {
        // server
        let server = null;

        return new Listr(
            [
                {
                    title: "Reset ganache",
                    task: () => {
                        return fs.remove(this.dbDir);
                    },
                },
                {
                    title: "Start ganache",
                    task: () => {
                        server = ganache.server({
                            wallet: {
                                accounts: [
                                    {
                                        balance: "0xfffffffffffffffffffffffffffffffffffffffffffff",
                                        secretKey: this.config.primaryAccount.privateKey,
                                    },
                                ]
                            },
                            miner: {
                                defaultGasPrice: "0x1",
                                blockGasLimit: "0xfffffffff",
                            },
                            database: {
                                dbPath: this.dbDir,
                            },
                            port: this.serverPort
                        });

                        return server.listen(this.serverPort);
                    },
                },
                {
                    title: "Deploy contracts on Main chain",
                    task: () =>
                        execa("bash", ["ganache-deployment.sh"], {
                            cwd: this.config.targetDirectory,
                            stdio: getRemoteStdio(),
                        }),
                },
                {
                    title: "Setup validators",
                    task: () => {
                        return this.getStakeTasks();
                    },
                },
                {
                    title: "Stop ganache",
                    task: () => {
                        if (!server) {
                            return;
                        }

                        return server.close();
                    },
                },
            ],
            {
                exitOnError: true,
            }
        );
    }

    async getTasks() {
        return new Listr(
            [
                ...this.contracts.cloneRepositoryTasks(),
                ...this.contracts.compileTasks(),
                {
                    title: "Process scripts",
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
                {
                    title: "Deploy contracts",
                    task: () => this.getContractDeploymentTasks(), // get contact deployment tasks
                },
                ...this.contracts.prepareContractAddressesTasks(), // prepare contract addresses and load in config
            ],
            {
                exitOnError: true,
            }
        );
    }
}

async function setupGanache(config) {
    const ganache = new Ganache(config, {
        contractsBranch: config.contractsBranch,
    });

    // get ganache tasks
    const tasks = await ganache.getTasks();

    await tasks.run();
    console.log("%s Ganache snapshot is ready", chalk.green.bold("DONE"));

    // print details
    await config.print();
    await ganache.print();
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

    // start ganache
    await setupGanache(config);
}
