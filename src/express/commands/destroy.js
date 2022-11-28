const shell = require("shelljs");

export async function terraformDestroy() {
    console.log("📍Executing terraform destroy...")
    require('dotenv').config({path: `${process.cwd()}/.env`})
    shell.exec(`terraform destroy -auto-approve`, {
        env: {
            ...process.env,
        }
    });
}
