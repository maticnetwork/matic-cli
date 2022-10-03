const shell = require("shelljs");

export async function terraformInit() {
    console.log("📍Executing terraform init...")
    shell.exec(`terraform init`, {
        env: {
            ...process.env,
        }
    });
}