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

Create new directory for the setup:

```bash
$ mkdir devnet
$ cd devnet
```

**To setup multi-node local network**

```bash
../bin/matic-cli setup devnet
```

It will ask you several questions:

```
Please enter number of validator nodes - Input the number of validator nodes you want to run
Please enter number of non-validator nodes - Input the number of sentry nodes you want to run
```

After the setup is done, follow these steps:

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
