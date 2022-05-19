# Matic CLI

🏗 A CLI to setup and manage Matic validator nodes

### Installation (Host Machine)

Please make sure you have installed following dependencies:

* Git
* Node v10.17.0
* Go 1.18+
* Docker
* Rabbitmq
* Ganache CLI
* Solc v0.5.11

### Installation (Remote Machine)

Please make sure you have installed following dependencies:

* Go 1.18+
* Rabbitmq
* Ganache CLI

### Usage

**----------------------------------------------**

**To setup multi-node local network (via docker)**

**----------------------------------------------**

Create new directory for the setup:

```bash
mkdir devnet
cd devnet
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

Logs

Logs will be at `logs/` folder

**----------------------------------**

**To setup multi-node remote network**

**----------------------------------**

Create new directory for the setup:

```bash
mkdir devnet
cd devnet
../bin/matic-cli setup devnet
```

It will ask you several questions:

```
Please enter number of validator nodes - Input the number of validator nodes you want to run
Please enter number of non-validator nodes - Input the number of sentry nodes you want to run
```

After the setup is done, follow these steps:
1. Log into first machine and run ganache
```bash
bash ganache-start-remote.sh
```

2. Log into the remote machines and on each machine run the following steps in different terminals
```bash
cd ~/node
bash heimdalld-setup.sh
heimdalld start
```

```bash
heimdalld rest-server
```

```bash
bridge start --all
```

```bash
cd ~/node
bash bor-clean.sh
bash bor-setup.sh
bash bor-start.sh
```

**-----------**

**Clean Setup**

**-----------**

Remove the devnet folder and you can start the process once again

## License

MIT
