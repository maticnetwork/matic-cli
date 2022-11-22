import {loadConfig, splitToArray, getDevnetId} from "../common/config-utils";
import {maxRetries, runSshCommand} from "../common/remote-worker";

const timer = ms => new Promise(res => setTimeout(res, ms))

export async function cleanup() {
   
    let devnetId = getDevnetId()
    require('dotenv').config({path: `${process.cwd()}/.env.devnet${devnetId}`})
    let doc = await loadConfig("remote")
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
            let command = `sudo systemctl stop ganache.service`
            await runSshCommand(ip, command, maxRetries)
        }

        console.log("📍Stopping heimdall on machine " + ip + "...")
        let command = `sudo systemctl stop heimdalld.service`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Stopping bor on machine " + ip + " ...")
        command = `sudo systemctl stop bor.service`
        await runSshCommand(ip, command, maxRetries)
    })

    await Promise.all(stopServiceTasks)

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
        let command = `heimdalld unsafe-reset-all`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Purging queue for heimdall bridge on machine " + ip + " ...")
        command = `heimdalld heimdall-bridge purge-queue`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Resetting heimdall bridge on machine " + ip + " ...")
        command = `heimdalld heimdall-bridge unsafe-reset-all`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Cleaning up bridge storage on machine " + ip + " ...")
        command = `rm -rf ~/.heimdalld/bridge`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Cleaning up bor on machine " + ip + " ...")
        command = `rm -rf ~/.bor/data`
        await runSshCommand(ip, command, maxRetries)
    })

    await Promise.all(cleanupServicesTasks)

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
            console.log("📍Running ganache in machine " + ip + " ...")
            let command = `sudo systemctl start ganache.service`
            await runSshCommand(ip, command, maxRetries)

            console.log("📍Deploying main net contracts on machine " + ip + " ...")
            command = `cd ~/matic-cli/devnet && bash ganache-deployment.sh`
            await runSshCommand(ip, command, maxRetries)

            console.log("📍Setting up validators on machine " + ip + " ...")
            command = `cd ~/matic-cli/devnet && bash ganache-stake.sh`
            await runSshCommand(ip, command, maxRetries)
        }

        console.log("📍Setting up heimdall on machine " + ip + " ...")
        let command = `bash ~/node/heimdalld-setup.sh`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Starting heimdall on machine " + ip + " ...")
        command = `sudo systemctl start heimdalld.service`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Setting bor on machine " + ip + " ...")
        command = `bash ~/node/bor-setup.sh`
        await runSshCommand(ip, command, maxRetries)

        console.log("📍Starting bor on machine " + ip + " ...")
        command = `sudo systemctl start bor.service`
        await runSshCommand(ip, command, maxRetries)
        
    })

    await Promise.all(startServicesTasks)
  
}

async function deployBorContractsAndStateSync(doc) {

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

}
