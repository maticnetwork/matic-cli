import execa from "execa";

const shell = require("shelljs");
const yaml = require('js-yaml');
const fs = require('fs');

require('dotenv').config();
let doc = {};

const timer = ms => new Promise(res => setTimeout(res, ms))

async function terraformInit() {
    console.log("Executing terraform init...")
    shell.exec(`terraform init`, {
        env: {
            ...process.env,
        }
    });
}

async function terraformApply() {
    console.log("Executing terraform apply...")
    shell.exec(`terraform apply -auto-approve`, {
        env: {
            ...process.env,
        }
    });
}

async function terraformDestroy() {
    console.log("Executing terraform destroy...")
    shell.exec(`terraform destroy -auto-approve`, {
        env: {
            ...process.env,
        }
    });
    // delete local terraform files
    // FIXME see POS-812 https://polygon.atlassian.net/browse/POS-812
    shell.exec(`rm -rf .terraform && rm .terraform.lock.hcl && rm terraform.tfstate && rm terraform.tfstate.backup`)
}

async function terraformOutput() {
    console.log("Executing terraform output...")
    const {stdout} = shell.exec(`terraform output --json`, {
        env: {
            ...process.env,
        }
    });

    return stdout
}

function setConfigValue(key, value) {
    if (value) {
        doc[key] = value;
    }
}

function setConfigList(key, value) {
    if (value) {
        value = value.split(' ').join('')
        const valueArray = value.split(",");
        if (valueArray.length > 0) {
            doc[key] = []
            for (let i = 0; i < valueArray.length; i++) {
                doc[key][i] = valueArray[i];

                if (i === 0) {
                    if (key === 'devnetBorHosts') {
                        setEthURL(valueArray[i]);
                    }
                    if (key === 'devnetBorUsers') {
                        setEthHostUser(valueArray[i]);
                    }
                }
            }
        }
    }
}

function setEthURL(value) {
    if (value) {
        doc['ethURL'] = 'http://' + value + ':9545';
        process.env.ETH_URL = doc['ethURL']
    }
}

function setEthHostUser(value) {
    if (value) {
        doc['ethHostUser'] = value;
        process.env.ETH_HOST_USER = value
    }
}

async function editMaticCliRemoteYAMLConfig() {
    console.log("Editing matic-cli remote YAML configs...")

    doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'), undefined);

    setConfigValue('defaultStake', parseInt(process.env.DEFAULT_STAKE));
    setConfigValue('defaultFee', parseInt(process.env.DEFAULT_FEE));
    setConfigValue('borChainId', parseInt(process.env.BOR_CHAIN_ID));
    setConfigValue('heimdallChainId', process.env.HEIMDALL_CHAIN_ID);
    setConfigValue('sprintSize', parseInt(process.env.SPRINT_SIZE));
    setConfigValue('blockNumber', process.env.BLOCK_NUMBER);
    setConfigValue('blockTime', process.env.BLOCK_TIME);
    setConfigValue('borBranch', process.env.BOR_BRANCH);
    setConfigValue('heimdallBranch', process.env.HEIMDALL_BRANCH);
    setConfigValue('contractsBranch', process.env.CONTRACTS_BRANCH);
    setConfigValue('numOfValidators', parseInt(process.env.TF_VAR_VALIDATOR_COUNT));
    setConfigValue('numOfNonValidators', parseInt(process.env.TF_VAR_SENTRY_COUNT));
    setConfigValue('devnetType', process.env.DEVNET_TYPE);
    setConfigValue('ethHostUser', process.env.ETH_HOST_USER);
    setConfigValue('borDockerBuildContext', process.env.BOR_DOCKER_BUILD_CONTENXT);
    setConfigValue('heimdallDockerBuildContext', process.env.HEIMDALL_DOCKER_BUILD_CONTENXT);

    setConfigList('devnetBorHosts', process.env.DEVNET_BOR_HOSTS);
    setConfigList('devnetHeimdallHosts', process.env.DEVNET_BOR_HOSTS);
    setConfigList('devnetBorUsers', process.env.DEVNET_BOR_USERS);
    setConfigList('devnetHeimdallUsers', process.env.DEVNET_BOR_USERS);

    fs.writeFile('./configs/devnet/remote-setup-config.yaml', yaml.dump(doc), (err) => {
        if (err) {
            console.log("Error while writing YAML configs: \n", err)
            process.exit(1)
        }
    });
}

async function installRequiredSoftwareOnRemoteMachines(ips) {
    let ipsArray = ips.split(' ').join('').split(",")
    console.log("VMs IPs: " + ipsArray)

    // TODO execute the following steps in parallel using Promises
    for (let i = 0; i < ipsArray.length; i++) {
        if (i === 0) {

            console.log("Copying certificate to " + ipsArray[i] + "~/cert.pem...")
            let src = `${process.env.PEM_FILE_PATH}`
            let dest = `${doc['ethHostUser']}@${ipsArray[i]}:~/cert.pem`
            await runScpCommand(src, dest)

            console.log("Adding ssh for " + ipsArray[i] + "~/cert.pem...")
            let machineIp = `${doc['ethHostUser']}@${ipsArray[i]}`
            let command = `sudo chmod 600 ~/cert.pem && eval "$(ssh-agent -s)" && ssh-add ~/cert.pem && exit`
            await runSshCommand(machineIp, command)

            console.log("Installing required software on remote host machine " + ipsArray[i] + "...")

            console.log("Allowing user not to use password...")
            command = `echo "${doc['ethHostUser']} ALL=(ALL) NOPASSWD:ALL" | sudo tee -a /etc/sudoers && exit`
            await runSshCommand(machineIp, command)

            console.log("Running apt update...")
            command = `sudo apt update -y  && exit`
            await runSshCommand(machineIp, command)

            console.log("Installing build-essential...")
            command = `sudo apt install build-essential -y && exit`
            await runSshCommand(machineIp, command)

            console.log("Installing nvm...")
            command = `curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash &&
                        export NVM_DIR="$HOME/.nvm"
                        [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                        [ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion" && 
                        nvm install 10.17.0 && exit`
            await runSshCommand(machineIp, command)

            console.log("Installing go...")
            command = `wget https://raw.githubusercontent.com/maticnetwork/node-ansible/master/go-install.sh &&
                         bash go-install.sh --remove &&
                         bash go-install.sh &&
                         source /home/ubuntu/.bashrc && exit`
            await runSshCommand(machineIp, command)

            console.log("Creating symlink for go...")
            command = `sudo ln -sf /home/ubuntu/.go/bin/go /usr/local/bin/go`
            await runSshCommand(machineIp, command)

            console.log("Installing solc...")
            command = `sudo snap install solc && exit`
            await runSshCommand(machineIp, command)

            console.log("Installing python2...")
            command = `sudo apt install python2 -y && alias python="/usr/bin/python2" && exit`
            await runSshCommand(machineIp, command)

            console.log("Installing nodejs and npm...")
            command = `sudo apt install nodejs npm -y && exit`
            await runSshCommand(machineIp, command)

            console.log("Creating symlink for npm and node...")
            command = `sudo ln -sf /home/ubuntu/.nvm/versions/node/v10.17.0/bin/npm /usr/bin/npm &&
                    sudo ln -sf /home/ubuntu/.nvm/versions/node/v10.17.0/bin/node /usr/bin/node`
            await runSshCommand(machineIp, command)

            console.log("Installing rabbitmq...")
            command = `sudo apt install rabbitmq-server -y && exit`
            await runSshCommand(machineIp, command)

            console.log("Installing ganache-cli...")
            command = `sudo npm install -g ganache-cli -y && exit`
            await runSshCommand(machineIp, command)

        } else {

            let borUsers = doc['devnetBorUsers'].toString().split(' ').join('').split(",")
            let borHosts = doc['devnetBorHosts'].toString().split(' ').join('').split(",")

            console.log("Installing required software on remote machines " + ipsArray[i] + "...")
            let machineIp = `${borUsers[i]}@${borHosts[i]}`

            console.log("Allowing user not to use password...")
            let command = `echo "${borUsers[i]} ALL=(ALL) NOPASSWD:ALL" | sudo tee -a /etc/sudoers && exit`
            await runSshCommand(machineIp, command)

            console.log("Running apt update...")
            command = `sudo apt update -y && exit`
            await runSshCommand(machineIp, command)

            console.log("Installing build-essential...")
            command = `sudo apt install build-essential -y && exit`
            await runSshCommand(machineIp, command)

            console.log("Installing rabbitmq...")
            command = `sudo apt install rabbitmq-server -y && exit`
            await runSshCommand(machineIp, command)

            console.log("Installing go...")
            command = `wget https://raw.githubusercontent.com/maticnetwork/node-ansible/master/go-install.sh &&
                         bash go-install.sh --remove &&
                         bash go-install.sh &&
                         source /home/ubuntu/.bashrc && exit`
            await runSshCommand(machineIp, command)

            console.log("Creating symlink for go...")
            command = `sudo ln -sf /home/ubuntu/.go/bin/go /usr/local/bin/go`
            await runSshCommand(machineIp, command)
        }
    }
}

async function runRemoteSetupWithMaticCLI(ips) {

    let ipsArray = ips.split(' ').join('').split(",")
    let machineIp = `${doc['ethHostUser']}@${ipsArray[0]}`

    let maticCliRepo = process.env.MATIC_CLI_REPO
    let maticCliBranch = process.env.MATIC_CLI_BRANCH

    console.log("Git checkout " + maticCliRepo + " and pull branch " + maticCliBranch + " on machine " + ipsArray[0])
    let command = `cd ~ && git clone ${maticCliRepo} && cd matic-cli && git checkout ${maticCliBranch}`
    await runSshCommand(machineIp, command)

    console.log("Installing matic-cli dependencies...")
    command = `cd ~/matic-cli && npm i`
    await runSshCommand(machineIp, command)

    console.log("Creating devnet and removing default configs...")
    command = `cd ~/matic-cli && mkdir devnet && rm configs/devnet/remote-setup-config.yaml`
    await runSshCommand(machineIp, command)

    console.log("Copying new matic-cli configurations...")
    let src = `./configs/devnet/remote-setup-config.yaml`
    let dest = `${doc['ethHostUser']}@${ipsArray[0]}:~/matic-cli/configs/devnet/remote-setup-config.yaml`
    await runScpCommand(src, dest)

    console.log("Executing remote setup with matic-cli...")
    command = `cd ~/matic-cli/devnet && ../bin/matic-cli setup devnet -c ../configs/devnet/remote-setup-config.yaml`
    await runSshCommand(machineIp, command)
}

async function runSshCommand(machineIp, command) {
    try {
        await execa('ssh', [
                `-o`, `StrictHostKeyChecking=no`, `-o`, `UserKnownHostsFile=/dev/null`,
                `-i`, `${process.env.PEM_FILE_PATH}`,
                machineIp,
                command],
            {stdio: 'inherit'})
    } catch (error) {
        console.log("Error while executing command: '" + command + "' : \n", error)
        process.exit(1)
    }
}

async function runScpCommand(src, dest) {
    try {
        await execa('scp', [
            `-o`, `StrictHostKeyChecking=no`, `-o`, `UserKnownHostsFile=/dev/null`,
            src,
            dest
        ], {stdio: 'inherit'})
    } catch (error) {
        console.log("Error while copying '" + src + "' to '" + dest + "': \n", error)
        process.exit(1)
    }
}

// start CLI
export async function cli(args) {
    console.log("Using Express CLI 🚀");

    switch (args[2]) {
        case "--start":

            await terraformApply();

            let tfOutput = await terraformOutput();
            let ips = JSON.parse(tfOutput).instance_ips.value.toString();
            process.env.DEVNET_BOR_HOSTS = ips;

            await editMaticCliRemoteYAMLConfig();

            console.log("Waiting 10s for the VM to initialize...")
            await timer(10000)

            await installRequiredSoftwareOnRemoteMachines(ips)

            await runRemoteSetupWithMaticCLI(ips);
            break;

        case "--destroy":
            await terraformDestroy();
            break;

        case "--init":
            await terraformInit();
            break;

        // TODO add an option for local docker setup
        // TODO add an option to rebuild & restart heimdall/bor on all remote nodes

        default:
            console.log("Please use --init or --start or --destroy");
            break;
    }
}

