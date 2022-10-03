const yaml = require("js-yaml");
const fs = require("fs");
const {runScpCommand} = require("../remote-worker");
const {maxRetries} = require("../constants");
const shell = require("shelljs");

export async function startStressTest(fund) {

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
    if (doc['devnetBorHosts'].length > 0) {
        console.log("📍Monitoring the first node", doc['devnetBorHosts'][0]);
    }
    let machine0 = doc['devnetBorHosts'][0];

    let src = `${doc['ethHostUser']}@${machine0}:~/matic-cli/devnet/devnet/signer-dump.json`
    let dest = `./signer-dump.json`
    await runScpCommand(src, dest, maxRetries)

    shell.pushd("tests/stress-test");
    shell.exec(`go mod tidy`);

    shell.exec(`go run main.go`, {
        env: {
            ...process.env, FUND: fund
        }
    });

    shell.popd();
}