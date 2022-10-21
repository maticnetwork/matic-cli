import yaml from "js-yaml";
import fs from "fs";
import {editMaticCliDockerYAMLConfig, editMaticCliRemoteYAMLConfig, splitToArray} from "../common/config-utils";
import {maxRetries, runScpCommand, runSshCommand} from "../common/remote-worker";

const shell = require("shelljs");
const timer = ms => new Promise(res => setTimeout(res, ms))

async function terraformApply() {
    console.log("📍Executing terraform apply...")
    shell.exec(`terraform apply -auto-approve`, {
        env: {
            ...process.env,
        }
    });
}

async function terraformOutput() {
    console.log("📍Executing terraform output...")
    const {stdout} = shell.exec(`terraform output --json`, {
        env: {
            ...process.env,
        }
    });

    return stdout
}

async function installRequiredSoftwareOnRemoteMachines(ips, devnetType) {

    let doc = await yaml.load(fs.readFileSync(`./configs/devnet/${devnetType}-setup-config.yaml`, 'utf8'));

    let ipsArray = splitToArray(ips)
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let username, user
    let users = []
    let isHostMap = new Map()

    for (let i = 0; i < ipsArray.length; i++) {
        i === 0 ? username = `${doc['ethHostUser']}` : `${borUsers[i]}`
        user = `${username}@${ipsArray[i]}`
        users.push(user)

        i === 0 ? isHostMap.set(user, true) : isHostMap.set(user, false)
    }

    let deps = users.map(async(user) => {
        await configureCertAndPermissions(user)
        await installCommonPackages(user)

        if (isHostMap.get(user)) {
            // Install Host dependencies
            await installHostSpecificPackages(user)

            if (process.env.TF_VAR_DOCKERIZED === 'yes') {
                await installDocker(user)
            }
        }

    })

    await Promise.all(deps)
}

async function configureCertAndPermissions(user) {

    let arr = []
    let username
    arr = user.split("@")
    username = arr[0]

    console.log("📍Allowing user not to use password...")
    let command = `echo "${username} ALL=(ALL) NOPASSWD:ALL" | sudo tee -a /etc/sudoers`
    await runSshCommand(user, command, maxRetries)

    console.log("📍Give permissions to all users for root folder...")
    command = `sudo chmod 755 -R ~/`
    await runSshCommand(user, command, maxRetries)

    console.log("📍Copying certificate to " + user + ":~/cert.pem...")
    let src = `${process.env.PEM_FILE_PATH}`
    let dest = `${user}:~/cert.pem`
    await runScpCommand(src, dest, maxRetries)

    console.log("📍Adding ssh for " + user + ":~/cert.pem...")
    command = `sudo chmod 700 ~/cert.pem && eval "$(ssh-agent -s)" && ssh-add ~/cert.pem && sudo chmod -R 700 ~/.ssh`
    await runSshCommand(user, command, maxRetries)
}

async function installCommonPackages(user) {
    console.log("📍Installing required software on remote machine " + user + "...")

    console.log("📍Running apt update...")
    let command = `sudo apt update -y`
    await runSshCommand(user, command, maxRetries)

    console.log("📍Installing build-essential...")
    command = `sudo apt install build-essential -y`
    await runSshCommand(user, command, maxRetries)

    console.log("📍Installing go...")
    command = `wget -nc https://raw.githubusercontent.com/maticnetwork/node-ansible/master/go-install.sh &&
                         bash go-install.sh --remove &&
                         bash go-install.sh &&
                         source ~/.bashrc`
    await runSshCommand(user, command, maxRetries)

    console.log("📍Creating symlink for go...")
    command = `sudo ln -sf ~/.go/bin/go /usr/local/bin/go`
    await runSshCommand(user, command, maxRetries)

    console.log("📍Installing rabbitmq...")
    command = `sudo apt install rabbitmq-server -y`
    await runSshCommand(user, command, maxRetries)
}

async function installHostSpecificPackages(user) {

    console.log("📍Installing nvm...")
    let command = `curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash &&
                        export NVM_DIR="$HOME/.nvm"
                        [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                        [ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion" && 
                        nvm install 10.17.0`
    await runSshCommand(user, command, maxRetries)

    console.log("📍Installing solc...")
    command = `sudo snap install solc`
    await runSshCommand(user, command, maxRetries)

    console.log("📍Installing python2...")
    command = `sudo apt install python2 -y && alias python="/usr/bin/python2"`
    await runSshCommand(user, command, maxRetries)

    console.log("📍Installing nodejs and npm...")
    command = `sudo apt install nodejs npm -y`
    await runSshCommand(user, command, maxRetries)

    console.log("📍Creating symlink for npm and node...")
    command = `sudo ln -sf ~/.nvm/versions/node/v10.17.0/bin/npm /usr/bin/npm &&
                    sudo ln -sf ~/.nvm/versions/node/v10.17.0/bin/node /usr/bin/node &&
                    sudo ln -sf ~/.nvm/versions/node/v10.17.0/bin/npx /usr/bin/npx`
    await runSshCommand(user, command, maxRetries)

    console.log("📍Installing ganache-cli...")
    command = `sudo npm install -g ganache-cli -y`
    await runSshCommand(user, command, maxRetries)
}

async function installDocker(user) {
    
    let arr = []
    let username
    arr = user.split("@")
    username = arr[0]

    console.log("📍Setting docker repository up...")
    let command = `sudo apt-get update -y && sudo apt install apt-transport-https ca-certificates curl software-properties-common -y`
    await runSshCommand(user, command, maxRetries)

    console.log("📍Installing docker...")
    command = `curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -`
    await runSshCommand(user, command, maxRetries)
    command = `sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable"`
    await runSshCommand(user, command, maxRetries)
    command = `sudo apt install docker-ce docker-ce-cli containerd.io -y`
    await runSshCommand(user, command, maxRetries)
    command = `sudo apt install docker-compose-plugin -y`
    await runSshCommand(user, command, maxRetries)

    console.log("📍Adding user to docker group...")
    command = `sudo usermod -aG docker ${username}`
    await runSshCommand(user, command, maxRetries)
}

async function prepareMaticCLI(ips, devnetType) {

    let doc = await yaml.load(fs.readFileSync(`./configs/devnet/${devnetType}-setup-config.yaml`, 'utf8'));
    let ipsArray = ips.split(' ').join('').split(",")
    let ip = `${doc['ethHostUser']}@${ipsArray[0]}`

    let maticCliRepo = process.env.MATIC_CLI_REPO
    let maticCliBranch = process.env.MATIC_CLI_BRANCH

    console.log("📍Git clone " + maticCliRepo + " if does not exist on " + ip)
    let command = `cd ~ && git clone ${maticCliRepo} || (cd ~/matic-cli; git fetch)`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Git checkout " + maticCliBranch + " and git pull on machine " + ip)
    command = `cd ~/matic-cli && git checkout ${maticCliBranch} && git pull || (cd ~/matic-cli && git stash && git stash drop && git pull)`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Installing matic-cli dependencies...")
    command = `cd ~/matic-cli && npm i`
    await runSshCommand(ip, command, maxRetries)
}

async function eventuallyCleanupPreviousDevnet(ips, devnetType) {

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));

    let ipsArray = splitToArray(ips)
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let users = []
    let isHostMap = new Map()
    let username, user

    for (let i = 0; i < ipsArray.length; i++) {
        i === 0 ? username = `${doc['ethHostUser']}` : `${borUsers[i]}`
        user = `${username}@${ipsArray[i]}`
        users.push(user)

        i === 0 ? isHostMap.set(user, true) : isHostMap.set(user, false)
    }

    let cleanup = users.map(async(user) => {

        if (isHostMap.get(user)) {
            // Cleanup Host 
            console.log("📍Removing old devnet (if present) on machine " + user + " ...")
            let command = `rm -rf ~/matic-cli/devnet`
            await runSshCommand(user, command, maxRetries)

            console.log("📍Stopping ganache (if present) on machine " + users[0] + " ...")
            command = `tmux send-keys -t matic-cli-ganache:0 'C-c' ENTER || echo 'ganache not running on current machine...'`
            await runSshCommand(user, command, maxRetries)

            console.log("📍Killing ganache tmux session (if present) on machine " + users[0] + " ...")
            command = `tmux kill-session -t matic-cli-ganache || echo 'matic-cli-ganache tmux session does not exist on current machine...'`
            await runSshCommand(user, command, maxRetries)
        }
        console.log("📍Stopping heimdall (if present) on machine " + user + " ...")
        let command = `tmux send-keys -t matic-cli:0 'C-c' ENTER || echo 'heimdall not running on current machine...'`
        await runSshCommand(user, command, maxRetries)

        console.log("📍Stopping bor (if present) on machine " + user + " ...")
        command = `tmux send-keys -t matic-cli:1 'C-c' ENTER || echo 'bor not running on current machine...'`
        await runSshCommand(user, command, maxRetries)

        console.log("📍Killing matic-cli tmux session (if present) on machine " + user + " ...")
        command = `tmux kill-session -t matic-cli || echo 'matic-cli tmux session does not exist on current machine...'`
        await runSshCommand(user, command, maxRetries)

        console.log("📍Removing .bor folder (if present) on machine " + user + " ...")
        command = `rm -rf ~/.bor`
        await runSshCommand(user, command, maxRetries)

        console.log("📍Removing .heimdalld folder (if present) on machine " + user + " ...")
        command = `rm -rf ~/.heimdalld`
        await runSshCommand(user, command, maxRetries)

        console.log("📍Removing data folder (if present) on machine " + user + " ...")
        command = `rm -rf ~/data`
        await runSshCommand(user, command, maxRetries)

        console.log("📍Removing node folder (if present) on machine " + user + " ...")
        command = `rm -rf ~/node`
        await runSshCommand(user, command, maxRetries)
    })

    await Promise.all(cleanup)

}

async function runDockerSetupWithMaticCLI(ips) {
    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let ipsArray = ips.split(' ').join('').split(",")
    let ip = `${doc['ethHostUser']}@${ipsArray[0]}`

    console.log("📍Creating devnet and removing default configs...")
    let command = `cd ~/matic-cli && mkdir -p devnet && rm configs/devnet/docker-setup-config.yaml`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Copying docker matic-cli configurations...")
    let src = `./configs/devnet/docker-setup-config.yaml`
    let dest = `${doc['ethHostUser']}@${ipsArray[0]}:~/matic-cli/configs/devnet/docker-setup-config.yaml`
    await runScpCommand(src, dest, maxRetries)

    console.log("📍Executing docker setup with matic-cli...")
    command = `cd ~/matic-cli/devnet && ../bin/matic-cli setup devnet -c ../configs/devnet/docker-setup-config.yaml`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Starting ganache...")
    command = `cd ~/matic-cli/devnet && bash docker-ganache-start.sh`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Starting heimdall...")
    command = `cd ~/matic-cli/devnet && bash docker-heimdall-start-all.sh`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Setting up bor...")
    command = `cd ~/matic-cli/devnet && bash docker-bor-setup.sh`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Starting bor...")
    command = `cd ~/matic-cli/devnet && bash docker-bor-start-all.sh`
    await runSshCommand(ip, command, maxRetries)

    await timer(120000)
    console.log("📍Deploying contracts for bor...")
    command = `cd ~/matic-cli/devnet && bash ganache-deployment-bor.sh`
    await runSshCommand(ip, command, maxRetries)

    await timer(120000)
    console.log("📍Deploying state-sync contracts...")
    command = `cd ~/matic-cli/devnet && bash ganache-deployment-sync.sh`
    await runSshCommand(ip, command, maxRetries)

    await timer(120000)
    console.log("📍Executing bor ipc tests...")
    console.log("📍1. Fetching admin.peers...")
    command = `cd ~/matic-cli/devnet && docker exec bor0 bash -c "bor attach /root/.bor/data/bor.ipc -exec 'admin.peers'"`
    await runSshCommand(ip, command, maxRetries)
    console.log("📍2. Fetching eth.blockNumber...")
    command = `cd ~/matic-cli/devnet && docker exec bor0 bash -c "bor attach /root/.bor/data/bor.ipc -exec 'eth.blockNumber'"`
    await runSshCommand(ip, command, maxRetries)
    console.log("📍bor ipc tests executed...")
}

async function runRemoteSetupWithMaticCLI(ips) {

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let ipsArray = ips.split(' ').join('').split(",")
    let ip = `${doc['ethHostUser']}@${ipsArray[0]}`

    console.log("📍Creating heimdall folder...")
    let command = `sudo mkdir -p /var/lib/heimdall`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Assigning proper permissions for heimdall folder...")
    command = `sudo chmod 777 -R /var/lib/heimdall/`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Creating devnet and removing default configs...")
    command = `cd ~/matic-cli && mkdir -p devnet && rm configs/devnet/remote-setup-config.yaml`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Copying remote matic-cli configurations...")
    let src = `./configs/devnet/remote-setup-config.yaml`
    let dest = `${doc['ethHostUser']}@${ipsArray[0]}:~/matic-cli/configs/devnet/remote-setup-config.yaml`
    await runScpCommand(src, dest, maxRetries)

    console.log("📍Executing remote setup with matic-cli...")
    command = `cd ~/matic-cli/devnet && ../bin/matic-cli setup devnet -c ../configs/devnet/remote-setup-config.yaml`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Deploying contracts for bor on machine " + ip + " ...")
    await timer(10000)
    command = `cd ~/matic-cli/devnet && bash ganache-deployment-bor.sh`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Deploying state-sync contracts on machine " + ip + " ...")
    await timer(10000)
    command = `cd ~/matic-cli/devnet && bash ganache-deployment-sync.sh`
    await runSshCommand(ip, command, maxRetries)
}

export async function start() {

    await terraformApply();
    let tfOutput = await terraformOutput();
    let ips = JSON.parse(tfOutput).instance_ips.value.toString();
    process.env.DEVNET_BOR_HOSTS = ips;

    let devnetType
    if (process.env.TF_VAR_DOCKERIZED === 'yes') {
        await editMaticCliDockerYAMLConfig();
        devnetType = "docker"
    } else {
        await editMaticCliRemoteYAMLConfig();
        devnetType = "remote"
    }

    console.log("📍Waiting 15s for the VMs to initialize...")
    await timer(15000)

    await installRequiredSoftwareOnRemoteMachines(ips, devnetType)

    await prepareMaticCLI(ips, devnetType)

    await eventuallyCleanupPreviousDevnet(ips, devnetType)

    if (process.env.TF_VAR_DOCKERIZED === 'yes') {
        await runDockerSetupWithMaticCLI(ips);
    } else {
        await runRemoteSetupWithMaticCLI(ips);
    }
}
