# Matic CLI

🏗 A CLI to setup and manage Matic validator nodes

### Installation (Host Machine, Ubuntu for e.g.)

Please make sure you have installed following dependencies:

* Build Essentials
    ```bash
    sudo apt update
    sudo apt install build-essential
    ```
* Node v10.17.0
    ```bash
    curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash
    nvm install 10.17.0
    ```
* Go 1.18+
    ```bash
    wget https://raw.githubusercontent.com/maticnetwork/node-ansible/master/go-install.sh
    bash go-install.sh --remove
    bash go-install.sh
    ```
* Docker (https://docs.docker.com/engine/install/ubuntu/, https://docs.docker.com/engine/install/linux-postinstall/)
* Solc v0.5.16
    ```bash
    sudo snap install solc
    ```
* Python 2
    ```bash
    sudo apt install python2
    alias python="/usr/bin/python2"
    ```

### Installation (Remote Machine, Ubuntu for e.g.)

Please make sure you have installed following dependencies:

* Go 1.18+
* Rabbitmq
    ```bash
    sudo apt install rabbitmq-server
    ```
* Npm (Only required on ganache remote machine)
    ```bash
    sudo apt update
    sudo apt install nodejs npm
    ```
* Ganache CLI (Only required on ganache remote machine)
    ```bash
    sudo npm install -g ganache-cli
    ```

### Usage

```bash
cd ~
git clone https://github.com/maticnetwork/matic-cli.git
cd matic-cli
npm i
mkdir devnet
cd devnet
```

#### To setup multi-node local network

```bash
../bin/matic-cli setup devnet -c ../configs/devnet/docker-setup-config.yaml
```

You can find more details about configuration options [here](configs/README.md).

Alternatively, setup a local/remote network interactively

```bash
../bin/matic-cli setup devnet -i
```

Notes:
1. We have provided the default values where ever so to ensure smooth functioning of the process
2.  Run `go get golang.org/x/sys@latest` on `./devnet/code/heimdall` if you get error - `//go:linkname must refer to declared function or variable`

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

Notes:
1. The host machine and remote machine has to be an linux machine with ubuntu as user
2. The ganache URL hostname will be used for ganache - http://<1st machine IP>:9545
3. Make sure that the host machines has access to remote machines for transferring the data
    ###### Tip to persist ssh key for remote access: 
    - eval "$(ssh-agent -s)"
    - ssh-add <pem/cer file(key to all the nodes in devnet)>
4. We have provided the default values where ever so to ensure smooth functioning of the process

**After the setup is done, follow these steps for local docker deployment:**

1. Log into first machine and run ganache:
```bash
cd ~/
bash ganache-start-remote.sh
```

2. Log into the remote machines and on each machine run the following steps in different terminals:
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
bash bor-setup.sh
bash bor-start.sh
```

#### Clean Setup

Remove the devnet folder and you can start the process once again

## License

MIT
