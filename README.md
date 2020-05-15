# Matic CLI

🏗 A CLI to setup and manage Matic validator nodes 

### Installation

```bash
npm install -g @maticnetwork/matic-cli
```

Please make sure you have installed following dependencies:

* Git
* Node/npm v10.17.0 (or higher)
* Go 1.13+
* Rabbitmq (Latest stable version)
* Solc v0.5.11 (https://solidity.readthedocs.io/en/v0.5.3/installing-solidity.html#binary-packages)
* Ganache CLI (https://www.npmjs.com/package/ganache-cli)

### Usage

Create new directory for the setup:

```bash
$ mkdir localnet
$ cd localnet
```

**Check commands**

```bash
matic-cli
```

**To setup local testnet**

This will setup Heimdall and Bor.

```bash
matic-cli setup localnet
```

**To setup Heimdall**

```bash
matic-cli setup heimdall
```

**To setup Bor**

```bash
matic-cli setup bor
```

**To generate genesis file**

```bash
matic-cli setup genesis
```

**To setup multi-node devnet**

```bash
matic-cli setup devnet
```

## License

MIT
