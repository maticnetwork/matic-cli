import { findMaxDevnetId } from "../common/files-utils";
import fs from "fs";

const shell = require("shelljs");

export async function terraformInit() {
    let nextDevnetId = !fs.existsSync('./deployments') ? 1 : findMaxDevnetId() + 1

    shell.exec(`mkdir -p ./deployments/devnet-${nextDevnetId}`)
    shell.exec(`cp ./.env ./deployments/devnet-${nextDevnetId}/.env`)
    shell.exec(`cp ./main.tf ./deployments/devnet-${nextDevnetId}/main.tf`)
    shell.exec(`cp ./variables.tf ./deployments/devnet-${nextDevnetId}/variables.tf`)

    require('dotenv').config({path: `./deployments/devnet-${nextDevnetId}/.env`})

    shell.pushd(`./deployments/devnet-${nextDevnetId}`)
    shell.exec(`terraform workspace new devnet-${nextDevnetId}`)
    shell.popd()

    console.log("📍Executing terraform init...")
    shell.exec(`terraform -chdir=./deployments/devnet-${nextDevnetId} init`, {
        env: {
            ...process.env,
        }
    });
}
