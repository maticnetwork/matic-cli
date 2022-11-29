import { start } from "./express/commands/start";
import { updateAll, updateBor, updateHeimdall } from "./express/commands/update";
import { terraformInit } from "./express/commands/init";
import { terraformDestroy } from "./express/commands/destroy";
import { startStressTest } from "./express/commands/stress";
import { sendStateSyncTx } from "./express/commands/send-state-sync";
import { monitor } from "./express/commands/monitor";
import { restartAll, restartBor, restartHeimdall } from "./express/commands/restart";
import { cleanup } from "./express/commands/cleanup";
import { setupDatadog } from "./express/commands/setup-datadog";
import { checkDir } from "./express/common/files-utils";
import { program } from "commander";
import pkg from "../package.json";


const timer = ms => new Promise(res => setTimeout(res, ms))

program
    .option('-i, --init', 'Initiate the terraform setup')
    .option('-s, --start', 'Start the setup')
    .option('-d, --destroy', 'Destroy the setup')
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
    .option('-dd, --setup-datadog', 'Setup DataDog')
    .version(pkg.version);


export async function cli() {

    console.log("\n📍Express CLI 🚀", "\nUse --help to see the available commands\n");

    program.parse(process.argv);
    const options = program.opts();

    if (options.init) {
        console.log("📍Command --init");
        if (!checkDir(true)) {
            console.log("❌ The command is supposed to be executed from the project root!");
            process.exit(1)
        }
        await terraformInit();
    }

    else if (options.start) {
        console.log("📍Command --start");
        if (!checkDir(false)) {
            console.log("❌ The command is not called from the appropriate devnet directory!");
            process.exit(1)
        }
        console.log("⛔ If you are targeting an already existing devnet, this command will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await start();
    }

    else if (options.destroy) {
        console.log("📍Command --destroy ");
        if (!checkDir(false)) {
            console.log("❌ The command is not called from the appropriate devnet directory!");
            process.exit(1)
        }
        await terraformDestroy();
    }

    else if (options.updateAll) {
        console.log("📍Command --update-all [index] ");
        if (!checkDir(false)) {
            console.log("❌ The command is not called from the appropriate devnet directory!");
            process.exit(1)
        }
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await updateAll(options.updateAll)
    }

    else if (options.updateBor) {
        console.log("📍Command --update-bor [index] ");
        if (!checkDir(false)) {
            console.log("❌ The command is not called from the appropriate devnet directory!");
            process.exit(1)
        }
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await updateBor(options.updateBor);
    }

    else if (options.updateHeimdall) {
        console.log("📍Command --update-heimdall [index] ");
        if (!checkDir(false)) {
            console.log("❌ The command is not called from the appropriate devnet directory!");
            process.exit(1)
        }
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        await timer(3000)
        await updateHeimdall(options.updateHeimdall);
    }

    else if (options.restartAll) {
        console.log("📍Command --restart-all [index] ");
        if (!checkDir(false)) {
            console.log("❌ The command is not called from the appropriate devnet directory!");
            process.exit(1)
        }
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await restartAll(options.restartAll);
    }

    else if (options.restartBor) {
        console.log("📍Command --restart-bor [index] ");
        if (!checkDir(false)) {
            console.log("❌ The command is not called from the appropriate devnet directory!");
            process.exit(1)
        }
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await restartBor(options.restartBor);
    }

    else if (options.restartHeimdall) {
        console.log("📍Command --restart-heimdall [index] ");
        if (!checkDir(false)) {
            console.log("❌ The command is not called from the appropriate devnet directory!");
            process.exit(1)
        }
        console.log("⛔ This command is only available for non-dockerized devnets...")
        await restartHeimdall(options.restartHeimdall);
    }

    else if (options.cleanup) {
        console.log("📍Command --cleanup ");
        if (!checkDir(false)) {
            console.log("❌ The command is not called from the appropriate devnet directory!");
            process.exit(1)
        }
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        console.log("⛔ This will only work if all bor ipc sessions have been manually closed...")
        await timer(3000)
        await cleanup();
    }

    else if (options.monitor) {
        console.log("📍Command --monitor ");
        if (!checkDir(false)) {
            console.log("❌ The command is not called from the appropriate devnet directory!");
            process.exit(1)
        }
        await timer(3000)
        await monitor();
    }

    else if (options.stress) {
        console.log("📍Command --stress ");
        if (!checkDir(false)) {
            console.log("❌ The command is not called from the appropriate devnet directory!");
            process.exit(1)
        }
        console.log("⛔ This command is only available for non-dockerized devnets. Make sure to target such environment...")
        await timer(3000)
        if (options.stress === "fund") {
            await startStressTest(true);
        } else {
            await startStressTest(false);
        }
    }

    else if (options.sendStateSync) {
        console.log("📍Command --send-state-sync ");
        if (!checkDir(false)) {
            console.log("❌ The command is not called from the appropriate devnet directory!");
            process.exit(1)
        }
        await timer(3000)
        await sendStateSyncTx();
    }

    else if (options.setupDatadog) {
        console.log("📍Command --setup-datadog");
        if (!checkDir(false)) {
            console.log("❌ The command is not called from the appropriate devnet directory!");
            process.exit(1)
        }
        await timer(3000)
        await setupDatadog();
    }
}
