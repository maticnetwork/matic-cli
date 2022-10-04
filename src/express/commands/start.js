import yaml from "js-yaml";
import fs from "fs";
import {editMaticCliDockerYAMLConfig, editMaticCliRemoteYAMLConfig, splitToArray} from "../common/config-utils";
import {runScpCommand, runSshCommand, maxRetries} from "../common/remote-worker";

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

async function installRequiredSoftwareOnRemoteMachines(ips) {

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));

    let ipsArray = splitToArray(ips)
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())

    let user, ip

    for (let i = 0; i < ipsArray.length; i++) {

        i === 0 ? user = `${doc['ethHostUser']}` : `${borUsers[i]}`
        ip = `${user}@${ipsArray[i]}`

        await configureCertAndPermissions(user, ip)
        await installCommonPackages(user, ip)

        if (i === 0) {
            await installHostSpecificPackages(ip)

            if (process.env.TF_VAR_DOCKERIZED === 'yes') {
                await installDocker(ip, user)
            }
        }
    }
}

async function configureCertAndPermissions(user, ip) {

    console.log("📍Allowing user not to use password...")
    let command = `echo "${user} ALL=(ALL) NOPASSWD:ALL" | sudo tee -a /etc/sudoers`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Give permissions to all users for root folder...")
    command = `sudo chmod 755 -R ~/`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Copying certificate to " + ip + ":~/cert.pem...")
    let src = `${process.env.PEM_FILE_PATH}`
    let dest = `${ip}:~/cert.pem`
    await runScpCommand(src, dest, maxRetries)

    console.log("📍Adding ssh for " + ip + ":~/cert.pem...")
    command = `sudo chmod 700 ~/cert.pem && eval "$(ssh-agent -s)" && ssh-add ~/cert.pem && sudo chmod -R 700 ~/.ssh`
    await runSshCommand(ip, command, maxRetries)
}

async function installCommonPackages(user, ip) {

    console.log("📍Installing required software on remote machine " + ip + "...")

    console.log("📍Running apt update...")
    let command = `sudo apt update -y`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Installing build-essential...")
    command = `sudo apt install build-essential -y`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Installing go...")
    command = `wget -nc https://raw.githubusercontent.com/maticnetwork/node-ansible/master/go-install.sh &&
                         bash go-install.sh --remove &&
                         bash go-install.sh &&
                         source ~/.bashrc`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Creating symlink for go...")
    command = `sudo ln -sf ~/.go/bin/go /usr/local/bin/go`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Installing rabbitmq...")
    command = `sudo apt install rabbitmq-server -y`
    await runSshCommand(ip, command, maxRetries)
}

async function installHostSpecificPackages(ip) {

    console.log("📍Installing nvm...")
    let command = `curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash &&
                        export NVM_DIR="$HOME/.nvm"
                        [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                        [ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion" && 
                        nvm install 10.17.0`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Installing solc...")
    command = `sudo snap install solc`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Installing python2...")
    command = `sudo apt install python2 -y && alias python="/usr/bin/python2"`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Installing nodejs and npm...")
    command = `sudo apt install nodejs npm -y`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Creating symlink for npm and node...")
    command = `sudo ln -sf ~/.nvm/versions/node/v10.17.0/bin/npm /usr/bin/npm &&
                    sudo ln -sf ~/.nvm/versions/node/v10.17.0/bin/node /usr/bin/node &&
                    sudo ln -sf ~/.nvm/versions/node/v10.17.0/bin/npx /usr/bin/npx`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Installing ganache-cli...")
    command = `sudo npm install -g ganache-cli -y`
    await runSshCommand(ip, command, maxRetries)
}

async function installDocker(ip, user) {

    console.log("📍Setting docker repository up...")
    let command = `sudo apt-get update -y && sudo apt install apt-transport-https ca-certificates curl software-properties-common -y`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Installing docker...")
    command = `curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -`
    await runSshCommand(ip, command, maxRetries)
    command = `sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable"`
    await runSshCommand(ip, command, maxRetries)
    command = `sudo apt install docker-ce docker-ce-cli containerd.io -y`
    await runSshCommand(ip, command, maxRetries)
    command = `sudo apt install docker-compose-plugin -y`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Adding user to docker group...")
    command = `sudo usermod -aG docker ${user}`
    await runSshCommand(ip, command, maxRetries)
}

async function prepareMaticCLI(ips) {

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let ipsArray = ips.split(' ').join('').split(",")
    let ip = `${doc['ethHostUser']}@${ipsArray[0]}`

    let maticCliRepo = process.env.MATIC_CLI_REPO
    let maticCliBranch = process.env.MATIC_CLI_BRANCH

    console.log("📍Git clone " + maticCliRepo + " if does not exist on " + ip)
    let command = `cd ~ && git clone ${maticCliRepo} || (cd ~/matic-cli; git fetch)`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Git checkout " + maticCliBranch + " and git pull on machine " + ip)
    command = `cd ~/matic-cli && git checkout ${maticCliBranch} && git pull`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Installing matic-cli dependencies...")
    command = `cd ~/matic-cli && npm i`
    await runSshCommand(ip, command, maxRetries)
}

async function runRemoteSetupWithMaticCLI(ips) {

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let ipsArray = ips.split(' ').join('').split(",")
    let ip = `${doc['ethHostUser']}@${ipsArray[0]}`

    console.log("📍Creating devnet and removing default configs...")
    let command = `cd ~/matic-cli && mkdir -p devnet && rm configs/devnet/remote-setup-config.yaml`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Copying remote matic-cli configurations...")
    let src = `./configs/devnet/remote-setup-config.yaml`
    let dest = `${doc['ethHostUser']}@${ipsArray[0]}:~/matic-cli/configs/devnet/remote-setup-config.yaml`
    await runScpCommand(src, dest, maxRetries)

    console.log("📍Executing remote setup with matic-cli...")
    command = `cd ~/matic-cli/devnet && ../bin/matic-cli setup devnet -c ../configs/devnet/remote-setup-config.yaml`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Deploying StateSync Contracts...")

    await timer(10000)
    command = `cd ~/matic-cli/devnet && bash ganache-deployment-bor.sh`
    await runSshCommand(ip, command, maxRetries)

    await timer(10000)
    command = `cd ~/matic-cli/devnet && bash ganache-deployment-sync.sh`
    await runSshCommand(ip, command, maxRetries)
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

    console.log("📍Setting bor up...")
    command = `cd ~/matic-cli/devnet && bash docker-bor-setup.sh`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Starting bor...")
    command = `cd ~/matic-cli/devnet && bash docker-bor-start-all.sh`
    await runSshCommand(ip, command, maxRetries)
}

export async function start() {

    await terraformApply();
    let tfOutput = await terraformOutput();
    let ips = JSON.parse(tfOutput).instance_ips.value.toString();
    process.env.DEVNET_BOR_HOSTS = ips;

    if (process.env.TF_VAR_DOCKERIZED === 'yes') {
        await editMaticCliDockerYAMLConfig(ips);
    } else {
        await editMaticCliRemoteYAMLConfig();
    }

    console.log("📍Waiting 15s for the VM to initialize...")
    await timer(15000)

    await installRequiredSoftwareOnRemoteMachines(ips)

    await prepareMaticCLI(ips)

// FIXME see POS-848
    if (process.env.TF_VAR_DOCKERIZED === 'yes') {
        await runDockerSetupWithMaticCLI(ips)
    } else {
        await runRemoteSetupWithMaticCLI(ips);
    }
}