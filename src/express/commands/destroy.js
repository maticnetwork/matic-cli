import { getDevnetId } from "../common/config-utils";

const shell = require("shelljs");

export async function terraformDestroy() {
    console.log("📍Executing terraform destroy...")
    var devnetId = getDevnetId()
    require('dotenv').config({path: `${process.cwd()}/.env.devnet${devnetId}`})
    shell.exec(`terraform destroy -auto-approve`, {
        env: {
            ...process.env,
        }
    });
}
