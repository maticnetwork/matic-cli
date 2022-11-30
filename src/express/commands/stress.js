import { getDevnetId, loadDevnetConfig } from "../common/config-utils";

const {runScpCommand, maxRetries} = require("../common/remote-worker");
const shell = require("shelljs");

export async function startStressTest(fund) {

    let doc = await loadDevnetConfig("remote")
    let devnetId = getDevnetId()
    require('dotenv').config({path: `${process.cwd()}/.env`})

    if (doc['devnetBorHosts'].length > 1) {
        console.log("📍Monitoring the first node", doc['devnetBorHosts'][0]);
    }
    let machine0 = doc['devnetBorHosts'][0];

    let src = `${doc['ethHostUser']}@${machine0}:~/matic-cli/devnet/devnet/signer-dump.json`
    let dest = `./signer-dump.json`
    await runScpCommand(src, dest, maxRetries)

    shell.pushd("../../tests/stress-test");
    shell.exec(`go mod tidy`);

    shell.exec(`go run main.go ${devnetId}`, {
        env: {
            ...process.env, FUND: fund
        }
    });

    shell.popd();
}
