import { loadConfig, getDevnetId } from "../common/config-utils";

const {runScpCommand, runSshCommand, maxRetries} = require("../common/remote-worker");

export async function sendStateSyncTx() {

    let devnetId = getDevnetId()
    require('dotenv').config({path: `${process.cwd()}/.env.devnet${devnetId}`})
    let devnetType = process.env.TF_VAR_DOCKERIZED === "yes" ? "docker" : "remote"
    
    let doc = await loadConfig(devnetType)
 
    if (doc['devnetBorHosts'].length > 0) {
        console.log("📍Monitoring the first node", doc['devnetBorHosts'][0]);
    } else {
        console.log("📍No nodes to monitor, please check your configs! Exiting...");
        process.exit(1)
    }

    let machine0 = doc['devnetBorHosts'][0];

    let src = `${doc['ethHostUser']}@${machine0}:~/matic-cli/devnet/code/contracts/contractAddresses.json`
    let dest = `./contractAddresses.json`
    await runScpCommand(src, dest, maxRetries)

    let contractAddresses = require(`${process.cwd()}/contractAddresses.json`);

    let MaticToken = contractAddresses.root.tokens.MaticToken;

    console.log("📍Sending StateSync Tx")
    let command = `cd ~/matic-cli/devnet/code/contracts && npm run truffle exec scripts/deposit.js -- --network development ${MaticToken} 100000000000000000000`
    await runSshCommand(`${doc['ethHostUser']}@${machine0}`, command, maxRetries)

    console.log(`📍StateSync Tx Sent, check with "./bin/express-cli --monitor"`)
}
