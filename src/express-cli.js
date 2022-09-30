import execa from "execa";

const shell = require("shelljs");
const yaml = require('js-yaml');
const fs = require('fs');
const fetch = require('node-fetch');

require('dotenv').config();
let doc = {};
let remoteStdio = 'inherit'

const timer = ms => new Promise(res => setTimeout(res, ms))

async function terraformInit() {
    console.log("📍Executing terraform init...")
    shell.exec(`terraform init`, {
        env: {
            ...process.env,
        }
    });
}

async function terraformApply() {
    console.log("📍Executing terraform apply...")
    shell.exec(`terraform apply -auto-approve`, {
        env: {
            ...process.env,
        }
    });
}

async function terraformDestroy() {
    console.log("📍Executing terraform destroy...")
    shell.exec(`terraform destroy -auto-approve`, {
        env: {
            ...process.env,
        }
    });
    // delete local terraform files
    shell.exec(`rm -rf .terraform && rm .terraform.lock.hcl && rm terraform.tfstate && rm terraform.tfstate.backup`)
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
    }
}

async function editMaticCliDockerYAMLConfig() {
    console.log("📍Editing matic-cli docker YAML configs...")

    doc = await yaml.load(fs.readFileSync('./configs/devnet/docker-setup-config.yaml', 'utf8'), undefined);

    setCommonConfigs()
    setEthURL('localhost');
    setEthHostUser(process.env.ETH_HOST_USER);

    fs.writeFile('./configs/devnet/docker-setup-config.yaml', yaml.dump(doc), (err) => {
        if (err) {
            console.log("❌ Error while writing docker YAML configs: \n", err)
            process.exit(1)
        }
    });
}

async function startStressTest(fund) {

    doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    if (doc['devnetBorHosts'].length > 0) {
        console.log("📍Monitoring the first node", doc['devnetBorHosts'][0]);
    }
    let machine0 = doc['devnetBorHosts'][0];

    let src = `${doc['ethHostUser']}@${machine0}:~/matic-cli/devnet/devnet/signer-dump.json`
    let dest = `./signer-dump.json`
    await runScpCommand(src, dest)

    shell.pushd("tests/stress-test");
    shell.exec(`go mod tidy`);

    shell.exec(`go run main.go`, {
        env: {
            ...process.env,
            FUND: fund
        }
    });

    shell.popd();
}

async function editMaticCliRemoteYAMLConfig() {
    console.log("📍Editing matic-cli remote YAML configs...")

    doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'), undefined);

    setCommonConfigs()
    setConfigList('devnetBorHosts', process.env.DEVNET_BOR_HOSTS);
    setConfigList('devnetHeimdallHosts', process.env.DEVNET_BOR_HOSTS);
    setConfigList('devnetBorUsers', process.env.DEVNET_BOR_USERS);
    setConfigList('devnetHeimdallUsers', process.env.DEVNET_BOR_USERS);

    fs.writeFile('./configs/devnet/remote-setup-config.yaml', yaml.dump(doc), (err) => {
        if (err) {
            console.log("❌ Error while writing remote YAML configs: \n", err)
            process.exit(1)
        }
    });
}

function setCommonConfigs() {
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
    setConfigValue('ethHostUser', process.env.ETH_HOST_USER);
    setConfigValue('borDockerBuildContext', process.env.BOR_DOCKER_BUILD_CONTENXT);
    setConfigValue('heimdallDockerBuildContext', process.env.HEIMDALL_DOCKER_BUILD_CONTENXT);
}

async function installRequiredSoftwareOnRemoteMachines(ips) {

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

function splitToArray(value) {
    return value.split(' ').join('').split(",")
}

async function configureCertAndPermissions(user, ip) {

    console.log("📍Allowing user not to use password...")
    let command = `echo "${user} ALL=(ALL) NOPASSWD:ALL" | sudo tee -a /etc/sudoers`
    await runSshCommand(ip, command)

    console.log("📍Give permissions to all users for root folder...")
    command = `sudo chmod 755 -R ~/`
    await runSshCommand(ip, command)

    console.log("📍Copying certificate to " + ip + ":~/cert.pem...")
    let src = `${process.env.PEM_FILE_PATH}`
    let dest = `${ip}:~/cert.pem`
    await runScpCommand(src, dest)

    console.log("📍Adding ssh for " + ip + ":~/cert.pem...")
    command = `sudo chmod 700 ~/cert.pem && eval "$(ssh-agent -s)" && ssh-add ~/cert.pem && sudo chmod -R 700 ~/.ssh`
    await runSshCommand(ip, command)
}

async function installCommonPackages(user, ip) {

    console.log("📍Installing required software on remote machine " + ip + "...")

    console.log("📍Running apt update...")
    let command = `sudo apt update -y`
    await runSshCommand(ip, command)

    console.log("📍Installing build-essential...")
    command = `sudo apt install build-essential -y`
    await runSshCommand(ip, command)

    console.log("📍Installing go...")
    command = `wget -nc https://raw.githubusercontent.com/maticnetwork/node-ansible/master/go-install.sh &&
                         bash go-install.sh --remove &&
                         bash go-install.sh &&
                         source ~/.bashrc`
    await runSshCommand(ip, command)

    console.log("📍Creating symlink for go...")
    command = `sudo ln -sf ~/.go/bin/go /usr/local/bin/go`
    await runSshCommand(ip, command)

    console.log("📍Installing rabbitmq...")
    command = `sudo apt install rabbitmq-server -y`
    await runSshCommand(ip, command)
}

async function installHostSpecificPackages(ip) {
    console.log("📍Installing nvm...")
    let command = `curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash &&
                        export NVM_DIR="$HOME/.nvm"
                        [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                        [ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion" && 
                        nvm install 10.17.0`
    await runSshCommand(ip, command)

    console.log("📍Installing solc...")
    command = `sudo snap install solc`
    await runSshCommand(ip, command)

    console.log("📍Installing python2...")
    command = `sudo apt install python2 -y && alias python="/usr/bin/python2"`
    await runSshCommand(ip, command)

    console.log("📍Installing nodejs and npm...")
    command = `sudo apt install nodejs npm -y`
    await runSshCommand(ip, command)

    console.log("📍Creating symlink for npm and node...")
    command = `sudo ln -sf ~/.nvm/versions/node/v10.17.0/bin/npm /usr/bin/npm &&
                    sudo ln -sf ~/.nvm/versions/node/v10.17.0/bin/node /usr/bin/node &&
                    sudo ln -sf ~/.nvm/versions/node/v10.17.0/bin/npx /usr/bin/npx`
    await runSshCommand(ip, command)

    console.log("📍Installing ganache-cli...")
    command = `sudo npm install -g ganache-cli -y`
    await runSshCommand(ip, command)
}

async function installDocker(ip, user) {
    console.log("📍Setting docker repository up...")
    let command = `sudo apt-get update -y && sudo apt install apt-transport-https ca-certificates curl software-properties-common -y`
    await runSshCommand(ip, command)

    console.log("📍Installing docker...")
    command = `curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -`
    await runSshCommand(ip, command)
    command = `sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable"`
    await runSshCommand(ip, command)
    command = `sudo apt install docker-ce docker-ce-cli containerd.io -y`
    await runSshCommand(ip, command)
    command = `sudo apt install docker-compose-plugin -y`
    await runSshCommand(ip, command)

    console.log("📍Adding user to docker group...")
    command = `sudo usermod -aG docker ${user}`
    await runSshCommand(ip, command)
}


async function prepareMaticCLI(ips) {

    let ipsArray = ips.split(' ').join('').split(",")
    let ip = `${doc['ethHostUser']}@${ipsArray[0]}`

    let maticCliRepo = process.env.MATIC_CLI_REPO
    let maticCliBranch = process.env.MATIC_CLI_BRANCH

    console.log("📍Git clone " + maticCliRepo + " if does not exist on " + ip)
    let command = `cd ~ && git clone ${maticCliRepo} || (cd ~/matic-cli; git fetch)`
    await runSshCommand(ip, command)

    console.log("📍Git checkout " + maticCliBranch + " and git pull on machine " + ip)
    command = `cd ~/matic-cli && git checkout ${maticCliBranch} && git pull`
    await runSshCommand(ip, command)

    console.log("📍Installing matic-cli dependencies...")
    command = `cd ~/matic-cli && npm i`
    await runSshCommand(ip, command)
}

async function runRemoteSetupWithMaticCLI(ips) {

    let ipsArray = ips.split(' ').join('').split(",")
    let ip = `${doc['ethHostUser']}@${ipsArray[0]}`

    console.log("📍Creating devnet and removing default configs...")
    let command = `cd ~/matic-cli && mkdir -p devnet && rm configs/devnet/remote-setup-config.yaml`
    await runSshCommand(ip, command)

    console.log("📍Copying remote matic-cli configurations...")
    let src = `./configs/devnet/remote-setup-config.yaml`
    let dest = `${doc['ethHostUser']}@${ipsArray[0]}:~/matic-cli/configs/devnet/remote-setup-config.yaml`
    await runScpCommand(src, dest)

    console.log("📍Executing remote setup with matic-cli...")
    command = `cd ~/matic-cli/devnet && ../bin/matic-cli setup devnet -c ../configs/devnet/remote-setup-config.yaml`
    await runSshCommand(ip, command)

    console.log("📍Deploying StateSync Contracts...")

    await timer(10000)
    command = `cd ~/matic-cli/devnet &&  bash ganache-deployment-bor.sh`
    await runSshCommand(ip, command)

    await timer(10000)
    command = `cd ~/matic-cli/devnet &&  bash ganache-deployment-sync.sh`
    await runSshCommand(ip, command)
}

async function runDockerSetupWithMaticCLI(ips) {

    let ipsArray = ips.split(' ').join('').split(",")
    let ip = `${doc['ethHostUser']}@${ipsArray[0]}`

    console.log("📍Creating devnet and removing default configs...")
    let command = `cd ~/matic-cli && mkdir -p devnet && rm configs/devnet/docker-setup-config.yaml`
    await runSshCommand(ip, command)

    console.log("📍Copying docker matic-cli configurations...")
    let src = `./configs/devnet/docker-setup-config.yaml`
    let dest = `${doc['ethHostUser']}@${ipsArray[0]}:~/matic-cli/configs/devnet/docker-setup-config.yaml`
    await runScpCommand(src, dest)

    console.log("📍Executing docker setup with matic-cli...")
    command = `cd ~/matic-cli/devnet && ../bin/matic-cli setup devnet -c ../configs/devnet/docker-setup-config.yaml`
    await runSshCommand(ip, command)

    console.log("📍Starting ganache...")
    command = `cd ~/matic-cli/devnet && bash docker-ganache-start.sh`
    await runSshCommand(ip, command)

    console.log("📍Starting heimdall...")
    command = `cd ~/matic-cli/devnet && bash docker-heimdall-start-all.sh`
    await runSshCommand(ip, command)

    console.log("📍Setting bor up...")
    command = `cd ~/matic-cli/devnet && bash docker-bor-setup.sh`
    await runSshCommand(ip, command)

    console.log("📍Starting bor...")
    command = `cd ~/matic-cli/devnet && bash docker-bor-start-all.sh`
    await runSshCommand(ip, command)
}

async function runSshCommand(ip, command) {
    try {
        await execa('ssh', [
                `-o`, `StrictHostKeyChecking=no`, `-o`, `UserKnownHostsFile=/dev/null`,
                `-i`, `${process.env.PEM_FILE_PATH}`,
                ip,
                command + ` && exit`],
            {stdio: remoteStdio})
    } catch (error) {
        console.log("❌ Error while executing command: '" + command + "' : \n", error)
        process.exit(1)
    }
}

async function runScpCommand(src, dest) {
    try {
        await execa('scp', [
            `-o`, `StrictHostKeyChecking=no`, `-o`, `UserKnownHostsFile=/dev/null`,
            `-i`, `${process.env.PEM_FILE_PATH}`,
            src,
            dest
        ], {stdio: remoteStdio})
    } catch (error) {
        console.log("❌ Error while copying '" + src + "' to '" + dest + "': \n", error)
        process.exit(1)
    }
}

async function sendStateSyncTx() {

    doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    if (doc['devnetBorHosts'].length > 0) {
        console.log("📍Monitoring the first node", doc['devnetBorHosts'][0]);
    }
    let machine0 = doc['devnetBorHosts'][0];

    let src = `${doc['ethHostUser']}@${machine0}:~/matic-cli/devnet/code/contracts/contractAddresses.json`
    let dest = `./contractAddresses.json`
    await runScpCommand(src, dest)

    let contractAddresses = require('../contractAddresses.json');
    let MaticToken = contractAddresses.root.tokens.MaticToken;

    console.log("📍Sending State-Sync Tx")
    let command = `cd ~/matic-cli/devnet/code/contracts && sudo npm run truffle exec scripts/deposit.js -- --network development ${MaticToken} 100000000000000000000`
    await runSshCommand(`${doc['ethHostUser']}@${machine0}`, command)

    console.log(`📍State-Sync Tx Sent, check with "./bin/express-cli --monitor"`)

}

async function checkCheckpoint(machine0) {
    let url = `http://${machine0}:1317/checkpoints/count`;
    let response = await fetch(url);
    let responseJson = await response.json();
    if (responseJson.result) {
        if (responseJson.result.result) {
            return responseJson.result.result
        }
    }

    return 0
}

async function checkStateSyncTx(machine0) {
    let url = `http://${machine0}:1317/clerk/event-record/1`;
    let response = await fetch(url);
    let responseJson = await response.json();
    if (responseJson.error) {
        return undefined
    } else {
        if (responseJson.result) {
            return responseJson.result.tx_hash
        }
    }

    return undefined
}

async function updateAll() {

    console.log("📍Will rebuild and rerun bor and heimdall with latest versions from given branches")

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let user, ip

    for (let i = 0; i < doc['devnetBorHosts'].length; i++) {

        i === 0 ? user = `${doc['ethHostUser']}` : `${borUsers[i]}`
        ip = `${user}@${doc['devnetBorHosts'][i]}`

        await stopAndRestartBor(ip, i)
        await stopAndRestartHeimdall(ip, i)

    }
}

async function updateBor() {

    console.log("📍Will rebuild and rerun bor with latest version from given branch")

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let user, ip

    for (let i = 0; i < doc['devnetBorHosts'].length; i++) {

        i === 0 ? user = `${doc['ethHostUser']}` : `${borUsers[i]}`
        ip = `${user}@${doc['devnetBorHosts'][i]}`

        await stopAndRestartBor(ip, i)

    }
}

async function updateHeimdall() {

    console.log("📍Will rebuild and rerun heimdall with latest version from given branch")

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let user, ip

    for (let i = 0; i < doc['devnetBorHosts'].length; i++) {

        i === 0 ? user = `${doc['ethHostUser']}` : `${borUsers[i]}`
        ip = `${user}@${doc['devnetBorHosts'][i]}`

        await stopAndRestartHeimdall(ip, i)

    }
}

async function stopAndRestartBor(ip, i) {

    console.log("📍Working on bor for machine " + ip + "...")

    let borRepo = process.env.BOR_REPO
    let borBranch = process.env.BOR_BRANCH

    console.log("📍Stopping bor...")
    let command = `tmux send-keys -t matic-cli:3 'C-c' ENTER`
    await runSshCommand(ip, command)

    if (i === 0) {

        console.log("📍Pulling bor latest changes for branch " + borBranch + " ...")
        command = `cd ~/matic-cli/devnet/code/bor && git fetch && git checkout ${borBranch} && git pull origin ${borBranch} `
        await runSshCommand(ip, command)

        console.log("📍Installing bor...")
        command = `cd ~/matic-cli/devnet/code/bor && make bor`
        await runSshCommand(ip, command)

    } else {

        console.log("📍Cloning bor repo...")
        command = `cd ~ && git clone ${borRepo} || (cd ~/bor; git fetch)`
        await runSshCommand(ip, command)

        console.log("📍Pulling bor latest changes for branch " + borBranch + " ...")
        command = `cd ~/bor && git fetch && git checkout ${borBranch} && git pull origin ${borBranch} `
        await runSshCommand(ip, command)

        console.log("📍Installing bor...")
        command = `cd ~/bor && make bor`
        await runSshCommand(ip, command)
    }

    console.log("📍Starting bor...")
    command = `tmux send-keys -t matic-cli:3 'bash ~/node/bor-start.sh' ENTER`
    await runSshCommand(ip, command)
}

async function stopAndRestartHeimdall(ip, i) {

    console.log("📍Working on heimdall for machine " + ip + "...")

    let heimdallRepo = process.env.HEIMDALL_REPO
    let heimdallBranch = process.env.HEIMDALL_BRANCH

    console.log("📍Stopping heimdall...")
    let command = `tmux send-keys -t matic-cli:0 'C-c' ENTER`
    await runSshCommand(ip, command)

    if (i === 0) {

        console.log("📍Pulling heimdall latest changes for branch " + heimdallBranch + " ...")
        command = `cd ~/matic-cli/devnet/code/heimdall && git fetch && git checkout ${heimdallBranch} && git pull origin ${heimdallBranch} `
        await runSshCommand(ip, command)

        console.log("📍Installing heimdall...")
        command = `cd ~/matic-cli/devnet/code/heimdall && make install`
        await runSshCommand(ip, command)

    } else {

        console.log("📍Cloning heimdall repo...")
        command = `cd ~ && git clone ${heimdallRepo} || (cd ~/heimdall; git fetch)`
        await runSshCommand(ip, command)

        console.log("📍Pulling heimdall latest changes for branch " + heimdallBranch + " ...")
        command = `cd ~/heimdall && git fetch && git checkout ${heimdallBranch} && git pull origin ${heimdallBranch} `
        await runSshCommand(ip, command)

        console.log("📍Installing heimdall...")
        command = `cd ~/heimdall && make install`
        await runSshCommand(ip, command)
    }

    console.log("📍Starting heimdall...")
    command = `tmux send-keys -t matic-cli:0 'heimdalld start' ENTER`
    await runSshCommand(ip, command)
}

async function monitor() {
    doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    if (doc['devnetBorHosts'].length > 0) {
        console.log("📍Monitoring the first node", doc['devnetBorHosts'][0]);
    }
    let machine0 = doc['devnetBorHosts'][0];
    console.log("📍Checking for statesyncs && Checkpoints")

    while (true) {

        await timer(1000);
        console.log()

        let checkpointCount = await checkCheckpoint(machine0);
        if (checkpointCount > 0) {
            console.log("📍Checkpoint found ✅ ; Count: ", checkpointCount);
        } else {
            console.log("📍Awaiting Checkpoint 🚌")
        }


        let stateSyncTx = await checkStateSyncTx(machine0);
        if (stateSyncTx) {
            console.log("📍Statesync found ✅ ; Tx_Hash: ", stateSyncTx);
        } else {
            console.log("📍Awaiting Statesync 🚌")
        }

        if (checkpointCount > 0 && stateSyncTx) {
            break;
        }

    }
}

// start CLI
export async function cli(args) {
    console.log("📍Using Express CLI 🚀");

    if (process.env.VERBOSE === 'false') {
        remoteStdio = 'ignore'
    }

    switch (args[2]) {
        case "--start":

            await terraformApply();

            let tfOutput = await terraformOutput();
            let ips = JSON.parse(tfOutput).instance_ips.value.toString();
            process.env.DEVNET_BOR_HOSTS = ips;

            if (process.env.TF_VAR_DOCKERIZED === 'yes') {
                await editMaticCliDockerYAMLConfig();
                doc['devnetBorUsers'] = ips
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
            break;

        case "--update-all":
            console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
            await timer(3000)
            await updateAll();
            break;

        case "--update-bor":
            console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
            await timer(3000)
            await updateBor();
            break;

        case "--update-heimdall":
            await updateHeimdall();
            break;

        case "--destroy":
            await terraformDestroy();
            break;

        case "--init":
            await terraformInit();
            break;

        case "--stress":
            if (args.length >= 4) {
                if (args[3] === "--init") {
                    await startStressTest(true);
                    break;
                }
            }

            await startStressTest(false);
            break;

        case "--send-state-sync":
            await sendStateSyncTx();
            break;

        case "--monitor":
            await monitor();
            break;

        default:
            console.log("⛔ Please use one of the following commands: \n " +
                "--init \n" +
                "--start \n" +
                "--destroy \n" +
                "--update-all \n" +
                "--update-bor \n" +
                "--update-heimdall \n" +
                "--send-state-sync \n" +
                "--monitor \n" +
                "--stress --init \n" +
                "--stress \n");
            break;
    }
}

