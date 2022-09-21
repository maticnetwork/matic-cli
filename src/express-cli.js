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

            console.log("Copying certificate to " + ipsArray[i] + "~/cert.pem ...")
            let src = `${process.env.PEM_FILE_PATH}`
            let dest = `${doc['ethHostUser']}@${ipsArray[i]}:~/cert.pem`
            await runScpCommand(src, dest)

            console.log("Add ssh for " + ipsArray[i] + "~/cert.pem ...")
            let machineIp = `${doc['ethHostUser']}@${ipsArray[i]}`
            let command = `eval "$(ssh-agent -s)" && ssh-add ~/cert.pem`
            await runSshCommand(machineIp, command)

            console.log("Installing required software on remote ganache machine " + ipsArray[i] + " ...")
            command = `echo "${doc['ethHostUser']} ALL=(ALL) NOPASSWD:ALL" | sudo tee -a /etc/sudoers &&
                         sudo apt update -y &&
                         sudo apt install nodejs npm -y &&
                         sudo apt install rabbitmq-server -y &&
                         sudo npm install -g ganache-cli -y`
            await runSshCommand(machineIp, command)

        } else {

            let borUsers = doc['devnetBorUsers'].toString().split(' ').join('').split(",")
            let borHosts = doc['devnetBorHosts'].toString().split(' ').join('').split(",")

            console.log("Installing required software on node remote machine " + ipsArray[i] + " ...")
            let machineIp = `${borUsers[i]}@${borHosts[i]}`
            let command = `echo "${borUsers[i]} ALL=(ALL) NOPASSWD:ALL" | sudo tee -a /etc/sudoers &&
                         sudo apt update -y &&
                         sudo apt install rabbitmq-server -y`
            await runSshCommand(machineIp, command)
        }
    }
}

async function runRemoteSetupWithMaticCLI(ips) {

    let ipsArray = ips.split(' ').join('').split(",")
    let maticCliRepo = process.env.MATIC_CLI_REPO
    let maticCliBranch = process.env.MATIC_CLI_BRANCH

    console.log("Git checkout " + maticCliRepo + " and pull branch " + maticCliBranch + " on machine " + ipsArray[0])
    let machineIp = doc['ethHostUser'] + "@" + ipsArray[0]
    let command = `cd ~ && git clone ${maticCliRepo} && cd matic-cli && git checkout ${maticCliBranch}`
    await runSshCommand(machineIp, command)

    console.log("Install matic-cli dependencies ...")
    command = `cd ~/matic-cli && npm i`
    await runSshCommand(machineIp, command)

    console.log("Creating devnet and removing default configs...")
    command = `cd ~/matic-cli && mkdir devnet && rm configs/devnet/remote-setup-config.yaml`
    await runSshCommand(machineIp, command)

    console.log("Copying new matic-cli configurations...")
    let src = `./configs/devnet/remote-setup-config.yaml`
    let dest = `${doc['ethHostUser']}@${ipsArray[0]}:~/matic-cli/configs/devnet/remote-setup-config.yaml`
    await runScpCommand(src, dest)

    console.log("Execute remote setup with matic-cli...")
    machineIp = `${doc['ethHostUser']}@${ipsArray[0]}`
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

