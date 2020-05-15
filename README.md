# Matic CLI

🏗 A CLI to setup and manage Matic validator nodes 

### Installation

```bash
npm install -g @maticnetwork/matic-cli
```

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
