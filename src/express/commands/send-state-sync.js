const yaml = require("js-yaml");
const fs = require("fs");
const {runScpCommand, runSshCommand} = require("../remote-worker");
const {maxRetries} = require("../constants");
const contractAddresses = require("../../../contractAddresses.json");

export async function sendStateSyncTx() {

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    if (doc['devnetBorHosts'].length > 0) {
        console.log("📍Monitoring the first node", doc['devnetBorHosts'][0]);
    }
    let machine0 = doc['devnetBorHosts'][0];

    let src = `${doc['ethHostUser']}@${machine0}:~/matic-cli/devnet/code/contracts/contractAddresses.json`
    let dest = `./contractAddresses.json`
    await runScpCommand(src, dest, maxRetries)

    let MaticToken = contractAddresses.root.tokens.MaticToken;

    console.log("📍Sending State-Sync Tx")
    let command = `cd ~/matic-cli/devnet/code/contracts && sudo npm run truffle exec scripts/deposit.js -- --network development ${MaticToken} 100000000000000000000`
    await runSshCommand(`${doc['ethHostUser']}@${machine0}`, command, maxRetries)

    console.log(`📍State-Sync Tx Sent, check with "./bin/express-cli --monitor"`)
}