const yaml = require("js-yaml");
const fs = require("fs");
const {splitToArray} = require("../common/config-utils");
const {runSshCommand, maxRetries} = require("../common/remote-worker");
import {checkAndReturnVMIndex} from "../common/config-utils";

export async function pullAndRestartBor(ip, i, isPull) {

    console.log("📍Working on bor for machine " + ip + "...")

    let borRepo = process.env.BOR_REPO
    let borBranch = process.env.BOR_BRANCH

    console.log("📍Stopping bor...")
    let command = `tmux send-keys -t matic-cli:1 'C-c' ENTER`
    await runSshCommand(ip, command, maxRetries)

    if (isPull) {

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
    }

    console.log("📍Starting bor...")
    command = `tmux send-keys -t matic-cli:1 'bash ~/node/bor-start.sh' ENTER`
    await runSshCommand(ip, command, maxRetries)
}

export async function pullAndRestartHeimdall(ip, i, isPull) {

    console.log("📍Working on heimdall for machine " + ip + "...")

    let heimdallRepo = process.env.HEIMDALL_REPO
    let heimdallBranch = process.env.HEIMDALL_BRANCH

    console.log("📍Stopping heimdall...")
    let command = `tmux send-keys -t matic-cli:0 'C-c' ENTER`
    await runSshCommand(ip, command, maxRetries)

    if (isPull) {

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
    }

    console.log("📍Starting heimdall...")
    command = `tmux send-keys -t matic-cli:0 'heimdalld start --chain=~/.heimdalld/config/genesis.json --bridge --all --rest-server' ENTER`
    await runSshCommand(ip, command, maxRetries)
}

export async function updateAll(n) {

    let vmIndex = await checkAndReturnVMIndex(n)
    console.log("📍Will rebuild and rerun bor and heimdall with latest versions from given branches")

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let nodeIps = []
    let hostToIndex = new Map()
    let user, ip

    if (vmIndex === undefined) {
        for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
            i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
            ip = `${user}@${doc['devnetBorHosts'][i]}`
            nodeIps.push(ip)
            hostToIndex.set(ip, i)
            //i === 0 ? isHostMap.set(ip, true) : isHostMap.set(ip, false)
        }

        let updateAllTasks = nodeIps.map(async(ip) => {
            await pullAndRestartBor(ip, hostToIndex.get(ip), true)
            await pullAndRestartHeimdall(ip, hostToIndex.get(ip), true)
        })

        await Promise.all(updateAllTasks)
        /*for (let i = 0; i < doc['devnetBorUsers'].length; i++) {
            i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
            ip = `${user}@${doc['devnetBorHosts'][i]}`
            await pullAndRestartBor(ip, i, true)
            await pullAndRestartHeimdall(ip, i, true)
        }*/
    } else {
        vmIndex === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[vmIndex]}`
        ip = `${user}@${doc['devnetBorHosts'][vmIndex]}`
        await pullAndRestartBor(ip, vmIndex, true)
        await pullAndRestartHeimdall(ip, vmIndex, true)
    }
}

export async function updateBor(n) {

    let vmIndex = await checkAndReturnVMIndex(n)
    console.log("📍Will rebuild and rerun bor with latest version from given branch")

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let nodeIps = []
    let hostToIndex = new Map()
    let user, ip

    if (vmIndex === undefined) {
        for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
            i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
            ip = `${user}@${doc['devnetBorHosts'][i]}`
            nodeIps.push(ip)
            hostToIndex.set(ip, i)
            //i === 0 ? isHostMap.set(ip, true) : isHostMap.set(ip, false)
        }

        let updateBorTasks = nodeIps.map(async(ip) => {
            await pullAndRestartBor(ip, hostToIndex.get(ip), true)
        })

        await Promise.all(updateBorTasks)
        /*for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
            i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
            ip = `${user}@${doc['devnetBorHosts'][i]}`
            await pullAndRestartBor(ip, i, true)
        }*/
    } else {
        vmIndex === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[vmIndex]}`
        ip = `${user}@${doc['devnetBorHosts'][vmIndex]}`
        await pullAndRestartBor(ip, vmIndex, true)
    }
}

export async function updateHeimdall(n) {

    let vmIndex = await checkAndReturnVMIndex(n)
    console.log("📍Will rebuild and rerun heimdall with latest version from given branch")

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let nodeIps = []
    let hostToIndex = new Map()
    let user, ip

    if (vmIndex === undefined) {
        for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
            i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
            ip = `${user}@${doc['devnetBorHosts'][i]}`
            nodeIps.push(ip)
            hostToIndex.set(ip, i)
            //i === 0 ? isHostMap.set(ip, true) : isHostMap.set(ip, false)
        }

        let updateHeimdallTasks = nodeIps.map(async(ip) => {
            await pullAndRestartHeimdall(ip, hostToIndex.get(ip), true)
        })

        await Promise.all(updateHeimdallTasks)
        /*for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
            i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
            ip = `${user}@${doc['devnetBorHosts'][i]}`
            await pullAndRestartHeimdall(ip, i, true)
        }*/
    } else {
        vmIndex === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[vmIndex]}`
        ip = `${user}@${doc['devnetBorHosts'][vmIndex]}`
        await pullAndRestartHeimdall(ip, vmIndex, true)
    }
}
