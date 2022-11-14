import { loadConfig } from "../common/config-utils";

const shell = require("shelljs");
const {runScpCommand, maxRetries} = require("../common/remote-worker");

export async function startStressTest(fund, devnetId) {
    if (process.env.TF_VAR_DOCKERIZED === 'yes' && devnetId === -1) {
        console.log(`❌ Current setup is dockerized. Exiting...`)
        process.exit(1)
    }

    let doc = await loadConfig("remote", devnetId)

    if (doc['devnetBorHosts'].length > 1) {
        console.log("📍Monitoring the first node", doc['devnetBorHosts'][0]);
    }
    let machine0 = doc['devnetBorHosts'][0];

    let src = `${doc['ethHostUser']}@${machine0}:~/matic-cli/devnet/devnet/signer-dump.json`
    let dest = `./signer-dump.json`
    await runScpCommand(src, dest, maxRetries)

    shell.pushd("tests/stress-test");
    shell.exec(`go mod tidy`);

    shell.exec(`go run main.go ${devnetId}`, {
        env: {
            ...process.env, FUND: fund
        }
    });

    shell.popd();
}