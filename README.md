# Testing Toolkit

🏗 A set of CLIs, tools and tests to set up, manage and operate Polygon devnets.

The **Testing Toolkit** is built on top of `express-cli`, an extension of `matic-cli` which uses `terraform` to deploy,
test and monitor any devnet on AWS stacks from any local system.

It currently supports **only** devnets running `v0.3.x` stacks.

The `express-cli` interacts with `terraform` to create a fully working setup on AWS.  
This setup is composed by a set of `EC2 VM` instances running a specific `ubuntu 22.04 ami`, mounted with `gp3 disks` ,
and a `public-subnet` with its `VPC`.  
In case the infrastructure already exists, `matic-cli` can be used as a standalone tool to deploy Polygon stacks on
pre-configured VMs.

Please, refer to the section of this file you are more interested in (`express-cli` or `matic-cli`)


## `express-cli`

### Requirements

To use the `express-cli` you have to execute the following steps.

- [install terraform](https://learn.hashicorp.com/tutorials/terraform/install-cli) on your local machine
- use [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) to switch to the proper `node` version, `v16.17.1`,
  by running `nvm use` from the root folder
- generate a keypair on AWS EC2 and download its certificate locally (`.pem` file)
- copy `.env.example` to `.env` with command `cp .env.example .env` and check the heavily commented file for details
- use `TF_VAR_DOCKERZIED=yes` to run the stack on one VM only in a dockerized environment. Else, it will create one VM
  per node
- replace `TF_VAR_ACCESS_KEY` and `TF_VAR_SECRET_KEY` with your own AWS keys
- define the number of nodes (`TF_VAR_VALIDATOR_COUNT` and `TF_VAR_SENTRY_COUNT`) and adjust the `DEVNET_BOR_USERS`
  accordingly
- (optional) replace `TF_VAR_VM_NAME` with your own identifier (it can be any string, default is "polygon-user")
- (optional) replace `TF_VAR_DISK_SIZE_GB` with your preferred disk size in GB (default is 500 GB)
- `VERBOSE=true` prints logs from the remote machines. If set to `false`, only `express-cli` and `matic-cli` logs will
  be shown
- make sure `PEM_FILE_PATH` points to a correct AWS key certificate, the one you downloaded in the previous steps
- install `express-cli` and `matic-cli` locally with command `npm i`

### Commands

Instructions to run `express-cli`.
For the list of commands, please run `express-cli --help`
First off, you need to `--init` terraform on your local machine, by executing the following command.

- `./bin/express-cli --init`
    - Initializes a new devnet folder with terraform and creates some git-ignored files locally. This step is mandatory 
      before running any other command. The new devnet folder created will be `devnet-<id>` where `id` is a monotonically
      increasing count for the devnets. Once created, you can `cd deployments/devnet-<id>` and run the other commands.
      This allows you to work with multiple devnets at once.
      Then, a remote devnet can be created with the `--start` command, as follows.

- `../../bin/express-cli --start`
    - Creates the desired remote setup, based on the preferences defined in the `.env.devnet<id>` file
    - `--start` command can be used also to target an existing AWS setup. If changes to `.env.devnet<id>` file are detected, the
       previous devnet will be destroyed and a new one created, reusing the same AWS VMs  
       To destroy the remote devnet, you can execute the `--destroy` command.

- `../../bin/express-cli --destroy`
    - Destroys the remote setup and delete the dedicated VMs
      The `express-cli` also comes with additional utility commands, listed below. Some of them are only available for
      non-dockerized devnets.

- `../../bin/express-cli --update-all [index]`
    - Fetches `heimdall` and `bor` branches defined as `HEIMDALL_BRANCH` and `BOR_BRANCH` in `.env.devnet<id>` file, 
      pulls relative changes and restarts those services on the remote machines. If an integer `index` is used, the job will be
      performed only on the VM corresponding to that index.

- `../../bin/express-cli --update-bor [index]`
    - Fetches `bor` branch defined as `BOR_BRANCH` in `.env.devnet<id>` file, pulls relative changes and restarts it on 
      the remote machines. If an integer `index` is used, the job will be performed only on the VM corresponding to that index.

- `../../bin/express-cli --update-heimdall [index]`
    - Fetches `heimdall` branch defined as `HEIMDALL_BRANCH` in `.env.devnet<id>` file, pulls relative changes and restarts it on
      the remote machines. If an integer `index` is used, the job will be performed only on the VM corresponding to that
      index.

- `../../bin/express-cli --restart-all [index]`
    - Restarts `bor` and `heimdall` on all the remote machines. If an integer `index` is used, the job will be performed
      only on the VM corresponding to that index.

- `../../bin/express-cli --restart-bor [index]`
    - Restarts `bor` on all the remote machines. If an integer `index` is used, the job will be performed only on the VM
      corresponding to that index.

- `../../bin/express-cli --restart-heimdall [index]`
    - Restarts `heimdall` on all the remote machines. If an integer `index` is used, the job will be performed only on
      the VM corresponding to that index.

- `../../bin/express-cli --cleanup`
    - Cleans up `ganache`, `bor`, `heimdall` and `bridge`, redeploys all the contracts and restarts all the services
      The `express-cli` also provides additional testing commands, listed here.

- `../../bin/express-cli --send-state-sync`
    - Create a `state-sync` transaction on the remote network

- ` ../../bin/express-cli --monitor`
    - Monitors the reception of state-syncs and checkpoints to make sure the whole network is in a healthy state.
      If `--send-state-sync` hasn't been used before, only checkpoints will be detected. The execution stops when
      a `state-sync` is found

- `../../bin/express-cli --stress [fund]`
    - Runs the stress tests on remote nodes. The string `fund` is needed when stress tests are ran for the first time,
      to fund the accounts


## `matic-cli`

`matic-cli` has to be installed on a `ubuntu` VM (_host_) and - through a config file - it will point to
other VMs' IPs (_remotes_).
* Host machine will run a Polygon node (`bor` and `heimdall`) and a layer 1 node (`ganache`)
* Remote machines will only run a Polygon node each

### Requirements

Please, make sure to install the following software/packages on the VMs.

* Build Essentials (_host_ and _remotes_)
    ```bash
    sudo apt update
    sudo apt install build-essential
    ```

* Go 1.18+ (_host_ and _remotes_)
    ```bash
    wget https://raw.githubusercontent.com/maticnetwork/node-ansible/master/go-install.sh
    bash go-install.sh --remove
    bash go-install.sh
    ```

* Rabbitmq (_host_ and _remotes_)
    ```bash
    sudo apt install rabbitmq-server
    ```

* Docker (_host_ and _remotes_, only needed in case of a docker setup)
  * https://docs.docker.com/engine/install/ubuntu/
  * https://docs.docker.com/engine/install/linux-postinstall/)


* Node v16.17.1 (only _host_)
    ```bash
    curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash
    nvm install 16.17.1
    ```

* Npm (only _host_)
    ```bash
    sudo apt update
    sudo apt install nodejs npm
    ```

* Python 2 (only _host_)
    ```bash
    sudo apt install python2 && alias python="/usr/bin/python2
    ```

* Solc v0.5.16 (only _host_)
    ```bash
    sudo snap install solc
    ```

* Ganache CLI (only _host_)
    ```bash
    sudo npm install -g ganache-cli
    ```

### Usage

On the _host_ machine, please run  

```bash
cd ~
git clone https://github.com/maticnetwork/matic-cli.git
cd matic-cli
npm i
mkdir devnet
cd devnet
```

#### Local dockerized network
Adjust the [docker configs](configs/devnet/docker-setup-config.yaml) and run  

```bash
../bin/matic-cli setup devnet -c ../configs/devnet/docker-setup-config.yaml
```

Once the setup is done, follow these steps for local docker deployment  

* Start ganache
  ```bash
  bash docker-ganache-start.sh
  ```

* Start `heimdall` instances (it will run all services - rabbitmq, heimdall, bridge, server)
  ```bash
  bash docker-heimdall-start-all.sh
  ```

* Setup `bor`
  ```bash
  bash docker-bor-setup.sh
  ```

* Start bor
  ```bash
  bash docker-bor-start-all.sh
  ```

Logs will be stored under `logs/` folder

Note: in case of docker setup, we have provided [some additional scripts](src/setup/devnet/templates/docker/README.md) which might be helpful.

#### Remote network
Adjust the [remote configs](configs/devnet/remote-setup-config.yaml) and run

```bash
../bin/matic-cli setup devnet -c ../configs/devnet/remote-setup-config.yaml
```

Alternatively, this step can be executed interactively with  

```bash
../bin/matic-cli setup devnet -i
```

#### Clean setup
Stop al services, remove the `matic-cli/devnet` folder, and you can start the process once again

#### Notes
1. The ganache URL hostname will be used for ganache `http://<host-machine-ip>:9545`
2. Make sure that the _host_ machine has access to remote machines for transferring the data
   To persist ssh key for remote access, please run:
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add `<.pem file>`
   ```
3. We have provided the default config values [here](configs/devnet) to ensure smooth functioning of the process  
   Please check the relative [README](configs/README.md) for more accurate description of such configs
   These files are used as templates and dynamically modified by `express-cli`, hence they should not be deleted nor any modification remotely pushed
   Therefore, they are under `.gitignore`, and in case you do not want those changes to be reflected in your local `git`,
   you can use the commands
  ```bash
  git update-index --assume-unchanged configs/devnet/remote-setup-config.yaml
  git update-index --assume-unchanged configs/devnet/docker-setup-config.yaml
  ```

## License

MIT
