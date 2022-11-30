import { loadDevnetConfig } from "../common/config-utils";

const fetch = require("node-fetch");
const Web3 = require('web3');
const timer = ms => new Promise(res => setTimeout(res, ms))
const { runScpCommand, maxRetries } = require("../common/remote-worker");

const lastStateIdABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "lastStateId",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }
]

const currentHeaderBlockABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "currentHeaderBlock",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }
]

const stateReceiverAddress = '0x0000000000000000000000000000000000001001';

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

async function checkStateSyncTx(ip, id) {
    let url = `http://${ip}:1317/clerk/event-record/${id}`;
    let response = await fetch(url);
    let responseJson = await response.json();
    if (responseJson.error) {
        return undefined
    } else {
        if (responseJson.result) {
            return responseJson.result
        }
    }

    return undefined
}

async function getStateSyncTxList(ip, startTime, endTime) {
    let url = `http://${ip}:1317/clerk/event-record/list?from-time=${startTime}&to-time=${endTime}&page=1&limit=200`;
    let response = await fetch(url);
    let responseJson = await response.json();
    if (responseJson.error) {
        return undefined
    } else {
        if (responseJson.result) {
            return responseJson.result
        }
    }

    return undefined
}

async function lastStateIdFromBor(ip) {
    let web3 = new Web3(`http://${ip}:8545`);

    let StateReceiverContract = await new web3.eth.Contract(lastStateIdABI, stateReceiverAddress);
    return await StateReceiverContract.methods.lastStateId().call()
}

async function getLatestCheckpointFromRootChain(ip, rootChainProxyAddress) {
    let web3 = new Web3(`http://${ip}:9545`);

    let RootChainContract = await new web3.eth.Contract(currentHeaderBlockABI, rootChainProxyAddress);
    let currentHeaderBlock = await RootChainContract.methods.currentHeaderBlock().call();
    return currentHeaderBlock.toString().slice(0, -4)
}

export async function monitor() {

    require('dotenv').config({path: `${process.cwd()}/.env`})
    let devnetType = process.env.TF_VAR_DOCKERIZED === "yes" ? "docker" : "remote"

    let doc = await loadDevnetConfig(devnetType)

    if (doc['devnetBorHosts'].length > 0) {
        console.log("📍Monitoring the first node", doc['devnetBorHosts'][0]);
    } else {
        console.log("📍No nodes to monitor, please check your configs! Exiting...");
        process.exit(1)
    }

    let machine0 = doc['devnetBorHosts'][0];
    console.log("📍Checking for StateSyncs && Checkpoints")

    let src = `${doc['ethHostUser']}@${machine0}:~/matic-cli/devnet/code/contracts/contractAddresses.json`
    let dest = `./contractAddresses.json`
    await runScpCommand(src, dest, maxRetries)

    let contractAddresses = require(`${process.cwd()}/contractAddresses.json`);

    let rootChainProxyAddress = contractAddresses.root.RootChainProxy;

    while (true) {

        await timer(1000);
        console.log()

        let checkpointCount = await checkCheckpoint(machine0);
        if (checkpointCount > 0) {
            console.log("📍Checkpoint found on Heimdall ✅ ; Count: ", checkpointCount);
        } else {
            console.log("📍Awaiting Checkpoint on Heimdall 🚌")
        }

        const checkpointCountFromRootChain = await getLatestCheckpointFromRootChain(machine0, rootChainProxyAddress);
        if (checkpointCountFromRootChain > 0) {
            console.log("📍Checkpoint found on Root chain ✅ ; Count: ", checkpointCountFromRootChain);
        } else {
            console.log("📍Awaiting Checkpoint on Root chain 🚌")
        }

        const firstStateSyncTx = await checkStateSyncTx(machine0, 1);
        let stateSyncTxList
        if (firstStateSyncTx) {
            let timeOfFirstStateSyncTx = firstStateSyncTx.record_time
            let firstEpochTime = parseInt(new Date(timeOfFirstStateSyncTx).getTime() / 1000);
            let currentEpochTime = parseInt(new Date().getTime() / 1000);
            stateSyncTxList = await getStateSyncTxList(machine0, firstEpochTime, currentEpochTime);
            if (stateSyncTxList) {
                let lastStateID = stateSyncTxList.length
                let lastStateSyncTxHash = stateSyncTxList[lastStateID - 1].tx_hash
                console.log("📍StateSyncs found on Heimdall ✅ ; Count: ", lastStateID, " ; Last Tx Hash: ", lastStateSyncTxHash);
            }
        } else {
            console.log("📍Awaiting StateSync 🚌")
        }

        let lastStateId = await lastStateIdFromBor(machine0);
        if (lastStateId) {
            console.log("📍LastStateId on Bor: ", lastStateId);
        } else {
            console.log("📍Unable to fetch LastStateId ")
        }

    }
}
