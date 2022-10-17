const shell = require("shelljs");

export async function terraformDestroy() {
    console.log("📍Executing terraform destroy...")
    shell.exec(`terraform destroy -auto-approve`, {
        env: {
            ...process.env,
        }
    });
}
