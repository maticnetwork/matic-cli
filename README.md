# Matic CLI

🏗 A CLI to setup and manage Matic validator nodes

### Installation

Please make sure you have installed following dependencies:

* Git
* Node/npm v13.12.0 (or higher)
* Go 1.18+
* Rabbitmq (Latest stable version)
* Solc v0.5.11 (https://solidity.readthedocs.io/en/v0.5.3/installing-solidity.html#binary-packages)
* Ganache CLI (https://www.npmjs.com/package/ganache-cli)

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
Please enter ETH url - http://ganache:9545
Please select devnet type - docker (for docker setup)
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

**SSH to docker containers through tmux**

For Heimdall

```bash
bash docker-heimdall-tmux.sh
```

For  Bor

```bash
bash docker-bor-tmux.sh
```

**Clean Setup**
Remove the localnet folder and you can start the process once again

## License

MIT
