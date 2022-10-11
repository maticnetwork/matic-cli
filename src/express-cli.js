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

require('dotenv').config();

const timer = ms => new Promise(res => setTimeout(res, ms))

program
    .option('-i, --init', 'Initiate the terraform setup')
    .option('-s, --start', 'Start the setup')
    .option('-d, --destroy', 'Destroy the setup')
    .option('-uall, --update-all', 'Update the setup')
    .option('-ubor, --update-bor', 'Update the bor setup')
    .option('-uheimdall, --update-heimdall', 'Update the heimdall setup')
    .option('-rall, --restart-all', 'Restart both bor and heimdall')
    .option('-rbor, --restart-bor', 'Restart bor')
    .option('-rheimdall, --restart-heimdall', 'Restart heimdall')
    .option('-c, --cleanup', 'Cleanup the setup')
    .option('-m, --monitor', 'Monitor the setup')
    .option('-t, --stress [fund]', 'Start the stress test')
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
        await start();
    }

    else if (options.destroy) {
        console.log("📍Command --destroy");
        await terraformDestroy();
    }

    else if (options.updateAll) {
        console.log("📍Command --update-all");
        console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await updateAll();
    }

    else if (options.updateBor) {
        console.log("📍Command --update-bor");
        console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await updateBor();
    }

    else if (options.updateHeimdall) {
        console.log("📍Command --update-heimdall");
        await updateHeimdall();
    }

    else if (options.restartAll) {
        console.log("📍Command --restart-all");
        await restartAll();
    }

    else if (options.restartBor) {
        console.log("📍Command --restart-bor");
        await timer(3000)
        await restartBor();
    }

    else if (options.restartHeimdall) {
        console.log("📍Command --restart-heimdall");
        await restartHeimdall();
    }

    else if (options.cleanup) {
        console.log("📍Command --cleanup");
        await cleanup();
    }

    else if (options.monitor) {
        console.log("📍Command --monitor");
        await monitor();
    }

    else if (options.stress) {
        console.log("📍Command --stress");
        if (options.stress === "fund") {
            await startStressTest(true);
        } else {
            await startStressTest(false);
        }
    }

    else if (options.sendStateSync) {
        console.log("📍Command --send-state-sync");
        await sendStateSyncTx();
    }
}

