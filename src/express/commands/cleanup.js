import yaml from "js-yaml";
import fs from "fs";
import {splitToArray} from "../common/config-utils";
import {maxRetries, runSshCommand} from "../common/remote-worker";

const timer = ms => new Promise(res => setTimeout(res, ms))

export async function cleanup() {
    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    await stopServices(doc)
    await cleanupServices(doc)
    await startServices(doc)
    await deployBorContractsAndStateSync(doc)
}

async function stopServices(doc) {

    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let nodeIps = []
    let isHostMap = new Map()
    let user, ip

    for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
        i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
        ip = `${user}@${doc['devnetBorHosts'][i]}`
        nodeIps.push(ip)

        i === 0 ? isHostMap.set(ip, true) : isHostMap.set(ip, false)
    }

    let stopServiceTasks = nodeIps.map(async(ip) => {
        if (isHostMap.get(ip)) {
            console.log("📍Stopping ganache on machine " + ip + " ...")
            let command = `tmux send-keys -t matic-cli-ganache:0 'C-c' ENTER`
            await runSshCommand(ip, command, maxRetries)
        }

        console.log("📍Stopping heimdall on machine " + ip + "...")
        let command = `tmux send-keys -t matic-cli:0 'C-c' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Stopping bor on machine " + ip + " ...")
        command = `tmux send-keys -t matic-cli:1 'C-c' ENTER`
        await runSshCommand(ip, command, maxRetries)
    })

    await Promise.all(stopServiceTasks)

    /*for (let i = 0; i < doc['devnetBorHosts'].length; i++) {

        i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
        ip = `${user}@${doc['devnetBorHosts'][i]}`

        if (i === 0) {
            console.log("📍Stopping ganache on machine " + ip + " ...")
            let command = `tmux send-keys -t matic-cli-ganache:0 'C-c' ENTER`
            await runSshCommand(ip, command, maxRetries)
        }

        console.log("📍Stopping heimdall on machine " + ip + "...")
        let command = `tmux send-keys -t matic-cli:0 'C-c' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Stopping bor on machine " + ip + " ...")
        command = `tmux send-keys -t matic-cli:1 'C-c' ENTER`
        await runSshCommand(ip, command, maxRetries)
    }*/
}

async function cleanupServices(doc) {

    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let nodeIps = []
    let isHostMap = new Map()
    let user, ip

    for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
        i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
        ip = `${user}@${doc['devnetBorHosts'][i]}`
        nodeIps.push(ip)

        i === 0 ? isHostMap.set(ip, true) : isHostMap.set(ip, false)
    }

    let cleanupServicesTasks = nodeIps.map(async(ip) => {
        if (isHostMap.get(ip)) {
            console.log("📍Cleaning up ganache on machine " + ip + " ...")
            let command = `rm -rf ~/data/ganache-db && rm -rf ~/matic-cli/devnet/data/ganache-db`
            await runSshCommand(ip, command, maxRetries)
        }

        console.log("📍Cleaning up heimdall on machine " + ip + " ...")
        let command = `tmux send-keys -t matic-cli:0 'heimdalld unsafe-reset-all' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Purging queue for heimdall bridge on machine " + ip + " ...")
        command = `tmux send-keys -t matic-cli:0 'heimdalld heimdall-bridge purge-queue' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Resetting heimdall bridge on machine " + ip + " ...")
        command = `tmux send-keys -t matic-cli:0 'heimdalld heimdall-bridge unsafe-reset-all' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Cleaning up bridge storage on machine " + ip + " ...")
        command = `rm -rf ~/.heimdalld/bridge`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Cleaning up bor on machine " + ip + " ...")
        command = `rm -rf ~/.bor/data`
        await runSshCommand(ip, command, maxRetries)
    })

    await Promise.all(cleanupServicesTasks)
    /*for (let i = 0; i < doc['devnetBorHosts'].length; i++) {

        i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
        ip = `${user}@${doc['devnetBorHosts'][i]}`


        if (i === 0) {
            console.log("📍Cleaning up ganache on machine " + ip + " ...")
            let command = `rm -rf ~/data/ganache-db && rm -rf ~/matic-cli/devnet/data/ganache-db`
            await runSshCommand(ip, command, maxRetries)
        }

        console.log("📍Cleaning up heimdall on machine " + ip + " ...")
        let command = `tmux send-keys -t matic-cli:0 'heimdalld unsafe-reset-all' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Purging queue for heimdall bridge on machine " + ip + " ...")
        command = `tmux send-keys -t matic-cli:0 'heimdalld heimdall-bridge purge-queue' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Resetting heimdall bridge on machine " + ip + " ...")
        command = `tmux send-keys -t matic-cli:0 'heimdalld heimdall-bridge unsafe-reset-all' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Cleaning up bridge storage on machine " + ip + " ...")
        command = `rm -rf ~/.heimdalld/bridge`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Cleaning up bor on machine " + ip + " ...")
        command = `rm -rf ~/.bor/data`
        await runSshCommand(ip, command, maxRetries)
    }*/

}

async function startServices(doc) {

    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let nodeIps = []
    let isHostMap = new Map()
    let user, ip

    for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
        i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
        ip = `${user}@${doc['devnetBorHosts'][i]}`
        nodeIps.push(ip)

        i === 0 ? isHostMap.set(ip, true) : isHostMap.set(ip, false)
    }

    let startServicesTasks = nodeIps.map(async(ip) => {
        if (isHostMap.get(ip)) {
            console.log("📍Running ganache in tmux on machine " + ip + " ...")
            let command = `tmux send-keys -t matic-cli-ganache:0 'bash ~/ganache-start-remote.sh' ENTER`
            await runSshCommand(ip, command, maxRetries)

            console.log("📍Deploying main net contracts on machine " + ip + " ...")
            command = `cd ~/matic-cli/devnet && bash ganache-deployment.sh`
            await runSshCommand(ip, command, maxRetries)

            console.log("📍Setting up validators on machine " + ip + " ...")
            command = `cd ~/matic-cli/devnet && bash ganache-stake.sh`
            await runSshCommand(ip, command, maxRetries)
        }

        console.log("📍Setting up heimdall on machine " + ip + " ...")
        let command = `tmux send-keys -t matic-cli:0 'bash ~/node/heimdalld-setup.sh' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Starting heimdall on machine " + ip + " ...")
        command = `tmux send-keys -t matic-cli:0 'heimdalld start --chain=~/.heimdalld/config/genesis.json --bridge --all --rest-server' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Setting up bor on machine " + ip + " ...")
        command = `tmux send-keys -t matic-cli:1 'bash ~/node/bor-setup.sh' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Starting bor on machine " + ip + " ...")
        command = `tmux send-keys -t matic-cli:1 'bash ~/node/bor-start.sh' ENTER`
        await runSshCommand(ip, command, maxRetries)
    })

    await Promise.all(startServicesTasks)
    /*for (let i = 0; i < doc['devnetBorHosts'].length; i++) {

        i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
        ip = `${user}@${doc['devnetBorHosts'][i]}`
        if (i === 0) {

            console.log("📍Running ganache in tmux on machine " + ip + " ...")
            let command = `tmux send-keys -t matic-cli-ganache:0 'bash ~/ganache-start-remote.sh' ENTER`
            await runSshCommand(ip, command, maxRetries)

            console.log("📍Deploying main net contracts on machine " + ip + " ...")
            command = `cd ~/matic-cli/devnet && bash ganache-deployment.sh`
            await runSshCommand(ip, command, maxRetries)

            console.log("📍Setting up validators on machine " + ip + " ...")
            command = `cd ~/matic-cli/devnet && bash ganache-stake.sh`
            await runSshCommand(ip, command, maxRetries)
        }

        console.log("📍Setting up heimdall on machine " + ip + " ...")
        let command = `tmux send-keys -t matic-cli:0 'bash ~/node/heimdalld-setup.sh' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Starting heimdall on machine " + ip + " ...")
        command = `tmux send-keys -t matic-cli:0 'heimdalld start --chain=~/.heimdalld/config/genesis.json --bridge --all --rest-server' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Setting up bor on machine " + ip + " ...")
        command = `tmux send-keys -t matic-cli:1 'bash ~/node/bor-setup.sh' ENTER`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Starting bor on machine " + ip + " ...")
        command = `tmux send-keys -t matic-cli:1 'bash ~/node/bor-start.sh' ENTER`
        await runSshCommand(ip, command, maxRetries)
    }*/
}

async function deployBorContractsAndStateSync(doc) {

    //let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let user, ip
    user = `${doc['ethHostUser']}`
    ip = `${user}@${doc['devnetBorHosts'][0]}`

    console.log("📍Deploying contracts for bor on machine " + ip + " ...")
    await timer(10000)
    let command = `cd ~/matic-cli/devnet && bash ganache-deployment-bor.sh`
    await runSshCommand(ip, command, maxRetries)

    console.log("📍Deploying state-sync contracts on machine " + ip + " ...")
    await timer(10000)
    command = `cd ~/matic-cli/devnet && bash ganache-deployment-sync.sh`
    await runSshCommand(ip, command, maxRetries)

    /*for (let i = 0; i < doc['devnetBorHosts'].length; i++) {

        i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
        ip = `${user}@${doc['devnetBorHosts'][i]}`

        if (i === 0) {
            console.log("📍Deploying contracts for bor on machine " + ip + " ...")
            await timer(10000)
            let command = `cd ~/matic-cli/devnet && bash ganache-deployment-bor.sh`
            await runSshCommand(ip, command, maxRetries)

            console.log("📍Deploying state-sync contracts on machine " + ip + " ...")
            await timer(10000)
            command = `cd ~/matic-cli/devnet && bash ganache-deployment-sync.sh`
            await runSshCommand(ip, command, maxRetries)
        }
    }*/
}
