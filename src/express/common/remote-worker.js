import execa from "execa";

export let remoteStdio = 'inherit'
export let maxRetries = 3

export async function runSshCommand(ip, command, retries) {
    if (retries < 0) {
        console.log("❌ runSshCommand called with negative retries number: ", retries)
        process.exit(1)
    }
    try {
        await execa('ssh',
            [`-o`, `StrictHostKeyChecking=no`, `-o`, `UserKnownHostsFile=/dev/null`,
                `-i`, `${process.env.PEM_FILE_PATH}`,
                ip, command + ` && exit`],
            {stdio: remoteStdio})
    } catch (error) {
        console.log("❌ Error while executing command: '" + command + "' : \n", error)
        if (retries - 1 > 0) {
            await runSshCommand(ip, command, retries - 1)
        } else {
            console.log("❌ SSH command " + command + " failed too many times, exiting... \n", error)
            process.exit(1)
        }
    }
}

export async function runScpCommand(src, dest, retries) {
    if (retries < 0) {
        console.log("❌ runScpCommand called with negative retries number: ", retries)
        process.exit(1)
    }
    try {
        await execa('scp',
            [`-o`, `StrictHostKeyChecking=no`, `-o`, `UserKnownHostsFile=/dev/null`,
                `-i`, `${process.env.PEM_FILE_PATH}`,
                src, dest],
            {stdio: remoteStdio})
    } catch (error) {
        console.log("❌ Error while copying '" + src + "' to '" + dest + "': \n", error)
        if (retries - 1 > 0) {
            await runScpCommand(src, dest, retries - 1)
        } else {
            console.log("❌ SCP copy failed too many times, exiting... \n", error)
            process.exit(1)
        }
    }
}