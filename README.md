# Matic CLI

🏗 A CLI to setup and manage Matic validator nodes

### Installation

Please make sure you have installed following dependencies:

* Git
* Node/npm v10.17.0 (or higher)
* Go 1.18+
* Docker (only if running on a docker based setup)
* Rabbitmq (Latest stable version, https://www.rabbitmq.com/download.html) (Not required for docker based setup)
* Solc v0.5.11 (https://solidity.readthedocs.io/en/v0.5.3/installing-solidity.html#binary-packages) (Not required for docker based setup)
* Ganache CLI (https://www.npmjs.com/package/ganache-cli) (Not required for docker based setup)

Please refer to [this](./installation.md) document for more information.

### Usage



**To setup multi-node network**

Create new directory for the setup:

```bash
mkdir devnet
cd devnet
```

```bash
../bin/matic-cli setup devnet
```

It will ask you several questions (default values are provided):

```
Please enter Bor chain id - Input the bor chain id you want
Please enter Heimdall chain id - Input the heimdall chain id you want
Please enter Bor docker tag - Input the bor tag you want to deploy
Please enter Heimdall docker tag - Input the heimdall tag you want to deploy
Please enter Contracts branch - Input the contracts branch
Please enter number of validator nodes - Input the number of validator nodes you want to run
Please enter number of non-validator nodes - Input the number of sentry nodes you want to run
Please enter ETH url - Input the eth url to use
Please select devnet type - Select deployment to be done locally via docker or to remote machines
```

**After the setup is done, follow these steps for local docker deployment:**

Start ganache
```bash
bash docker-ganache-start.sh
```

Start all heimdall instances (it will run all services - rabbitmq, heimdall, bridge, server)
```bash
bash docker-heimdall-start-all.sh
```

Setup bor
```bash
bash docker-bor-setup.sh
```

Start bor
```bash
bash docker-bor-start-all.sh
```

**Logs**

Logs will be at `logs/` folder

**Clean Setup**
Remove the devnet folder and you can start the process once again

## License

MIT
