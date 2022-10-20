import {maxRetries, runScpCommand, runSshCommand} from "../common/remote-worker";

const fetch = require("node-fetch");
const yaml = require("js-yaml");
const fs = require("fs");
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

export async function monitor() {

    if (process.env.TF_VAR_DOCKERIZED === 'yes') {

        let doc = await yaml.load(fs.readFileSync('./configs/devnet/docker-setup-config.yaml', 'utf8'));
        if (doc['devnetBorHosts'].length > 0) {
            console.log("📍Monitoring the first node", doc['devnetBorHosts'][0]);
        } else {
            console.log("📍No nodes to monitor, please check your docker configs! Exiting...");
            process.exit(1)
        }

        let machine0 = doc['devnetBorHosts'][0];

        console.log("📍Copying smoke-test.sh file for docker execution...")
        let src = `./scripts/smoke_test.sh`
        let dest = `${machine0}:~/matic-cli/smoke_test.sh`
        await runScpCommand(src, dest, maxRetries)

        console.log("📍Executing smoke_tests...")
        console.log("⛔ Please, make sure you ran --send-state-sync before executing these tests, or it will fail...")
        let command = `cd ~/matic-cli && bash smoke_test.sh`
        await runSshCommand(machine0, command, maxRetries)


    } else {

        let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
        if (doc['devnetBorHosts'].length > 0) {
            console.log("📍Monitoring the first node", doc['devnetBorHosts'][0]);
        } else {
            console.log("📍No nodes to monitor, please check your remote configs! Exiting...");
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
}
