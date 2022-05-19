# Matic CLI

🏗 A CLI to setup and manage Matic validator nodes

### Installation (Host Machine)

Please make sure you have installed following dependencies:

* Git
* Node v10.17.0
* Go 1.18+ (
    ```bash
    wget https://raw.githubusercontent.com/maticnetwork/node-ansible/master/go-install.sh
    bash go-install.sh --remove
    bash go-install.sh
    ```
)
* Docker
* Rabbitmq
* Ganache CLI
* Solc v0.5.11
* Python 2

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
Please select devnet type - docker
```

Notes:
1. We have provided the default values where ever so to ensure smooth functioning of the process

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
Please enter Bor chain id - Input the bor chain id you want
Please enter Heimdall chain id - Input the heimdall chain id you want
Please enter Bor docker tag - Input the bor tag you want to deploy
Please enter Heimdall docker tag - Input the heimdall tag you want to deploy
Please enter Contracts branch - Input the contracts branch
Please enter number of validator nodes - Input the number of validator nodes you want to run
Please enter number of non-validator nodes - Input the number of sentry nodes you want to run
Please enter ETH url - Input the eth url to use
Please select devnet type - remote
Please enter comma separated hosts/IPs - Enter the IPs
```

Notes:
1. We have assumed the host machine and remote machine to be an linux machine with ubuntu as user
2. We have assumed the first machine is being used for ganache as well so enter the ETH url as - http://<1st machine IP>:<PORT>
3. Make sure that the host machines has access to remote machines for transferring the data
4. We have provided the default values where ever so to ensure smooth functioning of the process

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
