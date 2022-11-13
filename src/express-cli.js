import { start } from "./express/commands/start";
import { updateAll, updateBor, updateHeimdall } from "./express/commands/update";
import { terraformInit } from "./express/commands/init";
import { terraformDestroy } from "./express/commands/destroy";
import { startStressTest } from "./express/commands/stress";
import { sendStateSyncTx } from "./express/commands/send-state-sync";
import { monitor } from "./express/commands/monitor";
import { restartAll, restartBor, restartHeimdall } from "./express/commands/restart";
import { cleanup } from "./express/commands/cleanup";
import { program } from "commander";
import pkg from "../package.json";

const shell = require("shelljs");

require('dotenv').config();

const timer = ms => new Promise(res => setTimeout(res, ms))

program
    .option('-i, --init', 'Initiate the terraform setup')
    .option('-s, --start', 'Start the setup')
    .option('-d, --destroy', 'Destroy the setup')
    .option('-dev, --devnet-id <id>', 'Id of the devnet being pointed to')
    .option('-uall, --update-all [index]', 'Update bor and heimdall on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index')
    .option('-ubor, --update-bor [index]', 'Update bor on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index')
    .option('-uheimdall, --update-heimdall [index]', 'Update heimdall on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index')
    .option('-rall, --restart-all [index]', 'Restart both bor and heimdall on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index')
    .option('-rbor, --restart-bor [index]', 'Restart bor on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index')
    .option('-rheimdall, --restart-heimdall [index]', 'Restart heimdall on all machines. If an integer [index] is specified, it will only update the VM corresponding to that index')
    .option('-c, --cleanup', 'Cleanup the setup')
    .option('-m, --monitor', 'Monitor the setup')
    .option('-t, --stress [fund]', 'Start the stress test. If the string `fund` is specified, the account will be funded. This option is mandatory when the command is executed the first time on a devnet.')
    .option('-ss, --send-state-sync', 'Send state sync tx')
    .version(pkg.version);


export async function cli() {

    console.log("\n📍Express CLI 🚀", "\nUse --help to see the available commands\n");

    program.parse(process.argv);
    const options = program.opts();

    if (options.init) {
        console.log("📍Command --init");
        await terraformInit();
    }

    else if (options.start) {
        console.log("📍Command --start");
        console.log("⛔ If you are targeting an already existing devnet, this command will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await start();
    }

    else if (options.destroy) {
        let devnetId = checkAndReturnDevnetId(options)
        console.log("📍Command --destroy --devnet-id <id>");

        if (devnetId !== -1) {
            // Switch workspace
            let out = shell.exec(`terraform workspace select devnet-${devnetId}`)
            if (out.stderr != '') {
                console.log("❌ Invalid devnet Id");
                process.exit(1)
            }
            await terraformDestroy();

            // Switch back to default workspace
            shell.exec(`terraform workspace select default`)

            // Delete workspace and remove configs
            shell.exec(`terraform workspace delete devnet-${devnetId}`)
            shell.exec(`rm -rf ./deployments/devnet-${devnetId}`)
        } else {
            // Ensure we're in default workspace
            shell.exec(`terraform workspace select default`)
            await terraformDestroy();

        }
    }

    else if (options.updateAll) {
        let devnetId = checkAndReturnDevnetId(options)
        console.log("📍Command --update-all [index] --devnet-id <id>");
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await updateAll(options.updateAll, devnetId)
    }

    else if (options.updateBor) {
        let devnetId = checkAndReturnDevnetId(options)
        console.log("📍Command --update-bor [index] --devnet-id <id>");
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await updateBor(options.updateBor, devnetId);
    }

    else if (options.updateHeimdall) {
        let devnetId = checkAndReturnDevnetId(options)
        console.log("📍Command --update-heimdall [index] --devnet-id <id>");
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        await timer(3000)
        await updateHeimdall(options.updateHeimdall, devnetId);
    }

    else if (options.restartAll) {
        let devnetId = checkAndReturnDevnetId(options)
        console.log("📍Command --restart-all [index] --devnet-id <id>");
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await restartAll(options.restartAll, devnetId);
    }

    else if (options.restartBor) {
        let devnetId = checkAndReturnDevnetId(options)
        console.log("📍Command --restart-bor [index] --devnet-id <id>");
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await restartBor(options.restartBor, devnetId);
    }

    else if (options.restartHeimdall) {
        let devnetId = checkAndReturnDevnetId(options)
        console.log("📍Command --restart-heimdall [index] --devnet-id <id>");
        console.log("⛔ This command is only available for non-dockerized devnets...")
        await restartHeimdall(options.restartHeimdall, devnetId);
    }

    else if (options.cleanup) {
        let devnetId = checkAndReturnDevnetId(options)
        console.log("📍Command --cleanup --devnet-id <id>");
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await cleanup(devnetId);
    }

    else if (options.monitor) {
        let devnetId = checkAndReturnDevnetId(options)
        console.log("📍Command --monitor --devnet-id <id>");
        await timer(3000)
        await monitor(devnetId);
    }

    else if (options.stress) {
        let devnetId = checkAndReturnDevnetId(options)
        console.log("📍Command --stress --devnet-id <id>");
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        await timer(3000)
        if (options.stress === "fund") {
            await startStressTest(true, devnetId);
        } else {
            await startStressTest(false, devnetId);
        }
    }

    else if (options.sendStateSync) {
        let devnetId = checkAndReturnDevnetId(options)
        console.log("📍Command --send-state-sync --devnet-id <id>");
        await timer(3000)
        await sendStateSyncTx(devnetId);
    }
}


function checkAndReturnDevnetId(options) {
    if (!options.devnetId) {
        return -1
    }
    
    return options.devnetId
}