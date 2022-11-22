const fetch = require("node-fetch");
const yaml = require("js-yaml");
const fs = require("fs");
const Web3 = require('web3');
const timer = ms => new Promise(res => setTimeout(res, ms))
const {runScpCommand, maxRetries} = require("../common/remote-worker");

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
        "constant":true,
        "inputs":[],
        "name":"currentHeaderBlock",
        "outputs":  [
            {
                "internalType":"uint256",
                "name":"",
                "type":"uint256"
            }
        ],
        "payable":false,
        "stateMutability":"view",
        "type":"function"
    }
]

var stateReceiverAddress = '0x0000000000000000000000000000000000001001'

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

async function checkStateSyncTx(ip,id) {
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

async function getStateSyncTxList(ip,startTime,endTime) {
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
    
    let StateReceiverContract = await new web3.eth.Contract(lastStateIdABI, stateReceiverAddress );
    let lastStateId = await StateReceiverContract.methods.lastStateId().call();

    return lastStateId
}

async function getLatestCheckpointFromBor(ip, rootChainProxyAddress){
    let web3 = new Web3(`http://${ip}:9545`);
    
    let RootChainContract = await new web3.eth.Contract(currentHeaderBlockABI, rootChainProxyAddress);
    let currentHeaderBlock = await RootChainContract.methods.currentHeaderBlock().call();
    let lastestCheckpointFromBor = currentHeaderBlock.toString().slice(0, -4);

    return lastestCheckpointFromBor
}

export async function monitor() {
    let doc

    if (process.env.TF_VAR_DOCKERIZED === 'yes') {
        doc = await yaml.load(fs.readFileSync('./configs/devnet/docker-setup-config.yaml', 'utf8'));
    } else {
        doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    }

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

    let contractAddresses = require("../../../contractAddresses.json");

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

        var checkpointCountFromBor = await getLatestCheckpointFromBor(machine0, rootChainProxyAddress);
        if(checkpointCountFromBor > 0) {
            console.log("📍Checkpoint found on Bor ✅ ; Count: ", checkpointCountFromBor);
        } else {
            console.log("📍Awaiting Checkpoint on Bor 🚌")
        }

        var firstStateSyncTx = await checkStateSyncTx(machine0,1);
        if (firstStateSyncTx) {
            let timeOfFirstStateSyncTx = firstStateSyncTx.record_time
            let firstEpochTime = parseInt(new Date(timeOfFirstStateSyncTx).getTime() / 1000);
            let currentEpochTime = parseInt(new Date().getTime() / 1000);
            let stateSyncTxList = await getStateSyncTxList(machine0,firstEpochTime,currentEpochTime);
            if (stateSyncTxList) {
                
                let lastStateID =  stateSyncTxList.length
                let lastStateSyncTxHash = stateSyncTxList[lastStateID-1].tx_hash
                console.log("📍StateSyncs found on Heimdall ✅ ; Count: ", lastStateID, " ; Last Tx Hash: ", lastStateSyncTxHash);
            }
            
        } else {
            console.log("📍Awaiting StateSync 🚌")
        }

        let lastStateId = await lastStateIdFromBor(machine0);
        if(lastStateId){
            console.log("📍LastStateId on Bor: ", lastStateId);
        }else {
            console.log("📍Unable to fetch LastStateId ")
        }

    }
}
