import fs from "fs";
import { loadConfig } from "../common/config-utils";

const fetch = require("node-fetch");
const timer = ms => new Promise(res => setTimeout(res, ms))

async function checkCheckpoint(ip) {
    let url = `http://${ip}:1317/checkpoints/count`;
    let response = await fetch(url);
    let responseJson = await response.json();
    if (responseJson.result) {
        if (responseJson.result.result) {
            return responseJson.result.result
        }
    }

    return 0
}

async function checkStateSyncTx(ip) {
    let url = `http://${ip}:1317/clerk/event-record/1`;
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

export async function monitor(devnetId) {

    let doc, devnetType
    if (devnetId !== -1) {
         devnetType = fs.existsSync(`./deployments/devnet-${devnetId}/docker-setup-config.yaml`) ? 'docker' : 'remote'
    } else {
        devnetType = process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'
    }
    
    doc = await loadConfig(devnetType, devnetId)

    if (doc['devnetBorHosts'].length > 0) {
        console.log("📍Monitoring the first node", doc['devnetBorHosts'][0]);
    } else {
        console.log("📍No nodes to monitor, please check your configs! Exiting...");
        process.exit(1)
    }

    let machine0 = doc['devnetBorHosts'][0];
    console.log("📍Checking for StateSyncs && Checkpoints")

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
            console.log("📍StateSync found ✅ ; Tx_Hash: ", stateSyncTx);
        } else {
            console.log("📍Awaiting StateSync 🚌")
        }

        if (checkpointCount > 0 && stateSyncTx) {
            break;
        }

    }
}
