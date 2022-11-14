import {pullAndRestartBor, pullAndRestartHeimdall} from "./update";
import {checkAndReturnVMIndex, loadConfig} from "../common/config-utils";

const {splitToArray} = require("../common/config-utils");

export async function restartAll(n, devnetId) {

    let doc = await loadConfig("remote", devnetId)
    if (devnetId !== -1) {
        console.log(`📍Will restart bor and heimdall on devnet-${devnetId} with latest versions from given branches`)
    } else {
        if (process.env.TF_VAR_DOCKERIZED === 'yes') {
            console.log(`❌ Current setup is dockerized. Exiting...`)
            process.exit(1)
        }
        console.log(`📍Will restart bor and heimdall on the current deployment with latest versions from given branches`)
    }

    let vmIndex = await checkAndReturnVMIndex(n, doc)
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let nodeIps = []
    let hostToIndexMap = new Map()
    let user, ip

    if (vmIndex === undefined) {
        for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
            i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
            ip = `${user}@${doc['devnetBorHosts'][i]}`
            nodeIps.push(ip)
            hostToIndexMap.set(ip, i)
        }

        let restartAllTasks = nodeIps.map(async(ip) => {
            await pullAndRestartBor(ip, hostToIndexMap.get(ip), false)
            await pullAndRestartHeimdall(ip, hostToIndexMap.get(ip), false)
        })

        await Promise.all(restartAllTasks)

    } else {
        vmIndex === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[vmIndex]}`
        ip = `${user}@${doc['devnetBorHosts'][vmIndex]}`
        await pullAndRestartBor(ip, vmIndex, false)
        await pullAndRestartHeimdall(ip, vmIndex, false)
    }
}

export async function restartBor(n, devnetId) {

    let doc = await loadConfig("remote", devnetId)
    if (devnetId !== -1) {
        console.log(`📍Will restart bor on devnet-${devnetId} with latest versions from given branches`)
    } else {
        if (process.env.TF_VAR_DOCKERIZED === 'yes') {
            console.log(`❌ Current setup is dockerized. Exiting...`)
            process.exit(1)
        }
        console.log(`📍Will restart bor on the current deployment with latest versions from given branches`)
    }

    let vmIndex = await checkAndReturnVMIndex(n, doc)
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let nodeIps = []
    let hostToIndexMap = new Map()
    let user, ip

    if (vmIndex === undefined) {
        for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
            i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
            ip = `${user}@${doc['devnetBorHosts'][i]}`
            nodeIps.push(ip)
            hostToIndexMap.set(ip, i)
        }

        let restartBorTasks = nodeIps.map(async(ip) => {
            await pullAndRestartBor(ip, hostToIndexMap.get(ip), false)
        })

        await Promise.all(restartBorTasks)

    } else {
        vmIndex === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[vmIndex]}`
        ip = `${user}@${doc['devnetBorHosts'][vmIndex]}`
        await pullAndRestartBor(ip, vmIndex, false)
    }
}

export async function restartHeimdall(n, devnetId) {

    let doc = await loadConfig("remote", devnetId)
    if (devnetId !== -1) {
        console.log(`📍Will restart heimdall on devnet-${devnetId} with latest versions from given branches`)
    } else {
        if (process.env.TF_VAR_DOCKERIZED === 'yes') {
            console.log(`❌ Current setup is dockerized. Exiting...`)
            process.exit(1)
        }
        console.log(`📍Will restart heimdall on the current deployment with latest versions from given branches`)
    }

    let vmIndex = await checkAndReturnVMIndex(n, doc)
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let nodeIps = []
    let hostToIndexMap = new Map()
    let user, ip

    if (vmIndex === undefined) {
        for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
            i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
            ip = `${user}@${doc['devnetBorHosts'][i]}`
            nodeIps.push(ip)
            hostToIndexMap.set(ip, i)
        }

        let restartHeimdallTasks = nodeIps.map(async(ip) => {
            await pullAndRestartHeimdall(ip, hostToIndexMap.get(ip), false)
        })

        await Promise.all(restartHeimdallTasks)
        
    } else {
        vmIndex === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[vmIndex]}`
        ip = `${user}@${doc['devnetBorHosts'][vmIndex]}`
        await pullAndRestartHeimdall(ip, vmIndex, false)
    }
}
