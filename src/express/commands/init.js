const shell = require("shelljs");
var path = require('path');
import fs from "fs";

export async function terraformInit() {
    let nextDevId = !fs.existsSync('./deployments') ? 0 : findMaxDevnetId() + 1

    shell.exec(`mkdir -p ./deployments/devnet-${nextDevId}`)
    shell.exec(`cp ./.env ./deployments/devnet-${nextDevId}/.env.devnet${nextDevId}`)
    shell.exec(`cp ./main.tf ./deployments/devnet-${nextDevId}/devnet${nextDevId}.main.tf`)
    shell.exec(`cp ./variables.tf ./deployments/devnet-${nextDevId}/devnet${nextDevId}.var.tf`)
    require('dotenv').config({path: `./deployments/devnet-${nextDevId}/.env.devnet${nextDevId}`})

    shell.pushd(`./deployments/devnet-${nextDevId}`)
    shell.exec(`terraform workspace new devnet-${nextDevId}`)
    shell.popd()

    console.log("📍Executing terraform init...")
    shell.exec(`terraform -chdir=./deployments/devnet-${nextDevId} init`, {
        env: {
            ...process.env,
        }
    });
    

}

function findMaxDevnetId() {
    var deployments = './deployments'
    var max = 0

    fs.readdirSync(deployments).forEach(file => {
        var match = file.match(/^devnet-(\d)/)
        if (!match)
            return;

        var num = Number(match[1]);
        if (num > max)
            max = num;
    })

    return max
}