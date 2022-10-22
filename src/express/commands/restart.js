import {pullAndRestartBor, pullAndRestartHeimdall} from "./update";
import {checkAndReturnVMIndex} from "../common/config-utils";

const yaml = require("js-yaml");
const fs = require("fs");
const {splitToArray} = require("../common/config-utils");

export async function restartAll(n) {

    let vmIndex = await checkAndReturnVMIndex(n)
    console.log("📍Will restart bor and heimdall")

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let user, ip

    if (vmIndex === undefined) {
        for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
            i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
            ip = `${user}@${doc['devnetBorHosts'][i]}`
            await pullAndRestartBor(ip, i, false)
            await pullAndRestartHeimdall(ip, i, false)
        }
    } else {
        vmIndex === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[vmIndex]}`
        ip = `${user}@${doc['devnetBorHosts'][vmIndex]}`
        await pullAndRestartBor(ip, vmIndex, false)
        await pullAndRestartHeimdall(ip, vmIndex, false)
    }
}

export async function restartBor(n) {

    let vmIndex = await checkAndReturnVMIndex(n)
    console.log("📍Will restart bor")

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let user, ip

    if (vmIndex === undefined) {
        for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
            i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
            ip = `${user}@${doc['devnetBorHosts'][i]}`
            await pullAndRestartBor(ip, i, false)
        }
    } else {
        vmIndex === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[vmIndex]}`
        ip = `${user}@${doc['devnetBorHosts'][vmIndex]}`
        await pullAndRestartBor(ip, vmIndex, false)
    }
}

export async function restartHeimdall(n) {

    let vmIndex = await checkAndReturnVMIndex(n)
    console.log("📍Will restart heimdall")

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let user, ip

    if (vmIndex === undefined) {
        for (let i = 0; i < doc['devnetBorHosts'].length; i++) {
            i === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[i]}`
            ip = `${user}@${doc['devnetBorHosts'][i]}`
            await pullAndRestartHeimdall(ip, i, false)
        }
    } else {
        vmIndex === 0 ? user = `${doc['ethHostUser']}` : user = `${borUsers[vmIndex]}`
        ip = `${user}@${doc['devnetBorHosts'][vmIndex]}`
        await pullAndRestartHeimdall(ip, vmIndex, false)
    }
}
