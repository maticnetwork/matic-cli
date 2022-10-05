import {start} from "./express/commands/start";
import {updateAll, updateBor, updateHeimdall} from "./express/commands/update";
import {terraformInit} from "./express/commands/init";
import {terraformDestroy} from "./express/commands/destroy";
import {startStressTest} from "./express/commands/stress";
import {sendStateSyncTx} from "./express/commands/send-state-sync";
import {monitor} from "./express/commands/monitor";
import {restartAll, restartBor, restartHeimdall} from "./express/commands/restart";

require('dotenv').config();

const timer = ms => new Promise(res => setTimeout(res, ms))

export async function cli(args) {

    console.log("📍Express CLI 🚀");

    switch (args[2]) {

        case "--init":
            console.log("📍Command --init");
            await terraformInit();
            break;

        case "--start":
            console.log("📍Command --start");
            await start()
            break;

        case "--destroy":
            console.log("📍Command --destroy");
            await terraformDestroy();
            break;

        case "--update-all":
            console.log("📍Command --update-all");
            console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
            await timer(3000)
            await updateAll();
            break;

        case "--update-bor":
            console.log("📍Command --update-bor");
            console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
            await timer(3000)
            await updateBor();
            break;

        case "--update-heimdall":
            console.log("📍Command --update-heimdall");
            await updateHeimdall();
            break;

        case "--restart-all":
            console.log("📍Command --restart-all");
            await restartAll();
            break;

        case "--restart-bor":
            console.log("📍Command --restart-bor");
            await timer(3000)
            await restartBor();
            break;

        case "--restart-heimdall":
            console.log("📍Command --restart-heimdall");
            await restartHeimdall();
            break;

        case "--stress":
            console.log("📍Command --stress");
            if (args.length >= 4) {
                if (args[3] === "--init") {
                    console.log("📍Using --init");
                    await startStressTest(true);
                    break;
                }
            }
            await startStressTest(false);
            break;

        case "--send-state-sync":
            console.log("📍Command --send-state-sync");
            await sendStateSyncTx();
            break;

        case "--monitor":
            console.log("📍Command --monitor");
            await monitor();
            break;

        default:
            console.log("⛔ Please use one of the following commands: \n "
                + "--init \n"
                + "--start \n"
                + "--destroy \n"
                + "--update-all \n"
                + "--update-bor \n"
                + "--update-heimdall \n"
                + "--restart-all \n"
                + "--restart-bor \n"
                + "--restart-heimdall \n"
                + "--send-state-sync \n"
                + "--monitor \n"
                + "--stress --init \n"
                + "--stress \n");
            break;
    }
}

