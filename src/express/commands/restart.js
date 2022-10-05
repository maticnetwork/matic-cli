import {pullAndRestartBor, pullAndRestartHeimdall} from "./update";

const yaml = require("js-yaml");
const fs = require("fs");
const {splitToArray} = require("../common/config-utils");

export async function restartAll() {

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let user, ip

    for (let i = 0; i < doc['devnetBorHosts'].length; i++) {

        i === 0 ? user = `${doc['ethHostUser']}` : `${borUsers[i]}`
        ip = `${user}@${doc['devnetBorHosts'][i]}`

        await pullAndRestartBor(ip, i, false)
        await pullAndRestartHeimdall(ip, i, false)
    }
}

export async function restartBor() {

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let user, ip

    for (let i = 0; i < doc['devnetBorHosts'].length; i++) {

        i === 0 ? user = `${doc['ethHostUser']}` : `${borUsers[i]}`
        ip = `${user}@${doc['devnetBorHosts'][i]}`

        await restartBor(ip, i, false)
    }
}

export async function restartHeimdall() {

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    let borUsers = splitToArray(doc['devnetBorUsers'].toString())
    let user, ip

    for (let i = 0; i < doc['devnetBorHosts'].length; i++) {

        i === 0 ? user = `${doc['ethHostUser']}` : `${borUsers[i]}`
        ip = `${user}@${doc['devnetBorHosts'][i]}`

        await pullAndRestartHeimdall(ip, i, false)
    }
}