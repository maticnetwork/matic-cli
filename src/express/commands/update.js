const yaml = require("js-yaml");
const fs = require("fs");
const {splitToArray} = require("../common/config-utils");
const {runSshCommand, maxRetries} = require("../common/remote-worker");

async function stopAndRestartBor(ip, i) {

    console.log("📍Working on bor for machine " + ip + "...")

    let borRepo = process.env.BOR_REPO
    let borBranch = process.env.BOR_BRANCH

    console.log("📍Stopping bor...")
    let command = `tmux send-keys -t matic-cli:3 'C-c' ENTER`
    await runSshCommand(ip, command, maxRetries)

    if (i === 0) {

        console.log("📍Pulling bor latest changes for branch " + borBranch + " ...")
        command = `cd ~/matic-cli/devnet/code/bor && git fetch && git checkout ${borBranch} && git pull origin ${borBranch} `
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Installing bor...")
        command = `cd ~/matic-cli/devnet/code/bor && make bor`
        await runSshCommand(ip, command, maxRetries)

    } else {

        console.log("📍Cloning bor repo...")
        command = `cd ~ && git clone ${borRepo} || (cd ~/bor; git fetch)`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Pulling bor latest changes for branch " + borBranch + " ...")
        command = `cd ~/bor && git fetch && git checkout ${borBranch} && git pull origin ${borBranch} `
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Installing bor...")
        command = `cd ~/bor && make bor`
        await runSshCommand(ip, command, maxRetries)
    }

    console.log("📍Starting bor...")
    command = `tmux send-keys -t matic-cli:3 'bash ~/node/bor-start.sh' ENTER`
    await runSshCommand(ip, command, maxRetries)
}

async function stopAndRestartHeimdall(ip, i) {

    console.log("📍Working on heimdall for machine " + ip + "...")

    let heimdallRepo = process.env.HEIMDALL_REPO
    let heimdallBranch = process.env.HEIMDALL_BRANCH

    console.log("📍Stopping heimdall...")
    let command = `tmux send-keys -t matic-cli:0 'C-c' ENTER`
    await runSshCommand(ip, command, maxRetries)

    if (i === 0) {

        console.log("📍Pulling heimdall latest changes for branch " + heimdallBranch + " ...")
        command = `cd ~/matic-cli/devnet/code/heimdall && git fetch && git checkout ${heimdallBranch} && git pull origin ${heimdallBranch} `
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Installing heimdall...")
        command = `cd ~/matic-cli/devnet/code/heimdall && make install`
        await runSshCommand(ip, command, maxRetries)

    } else {

        console.log("📍Cloning heimdall repo...")
        command = `cd ~ && git clone ${heimdallRepo} || (cd ~/heimdall; git fetch)`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Pulling heimdall latest changes for branch " + heimdallBranch + " ...")
        command = `cd ~/heimdall && git fetch && git checkout ${heimdallBranch} && git pull origin ${heimdallBranch} `
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Installing heimdall...")
        command = `cd ~/heimdall && make install`
        await runSshCommand(ip, command, maxRetries)
    }

    console.log("📍Starting heimdall...")
    command = `tmux send-keys -t matic-cli:0 'heimdalld start' ENTER`
    await runSshCommand(ip, command, maxRetries)
}

export async function updateAll() {

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

export async function updateBor() {

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

export async function updateHeimdall() {

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