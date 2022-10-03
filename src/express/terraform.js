const shell = require("shelljs");

export async function terraformInit() {
    console.log("📍Executing terraform init...")
    shell.exec(`terraform init`, {
        env: {
            ...process.env,
        }
    });
}

export async function terraformApply() {
    console.log("📍Executing terraform apply...")
    shell.exec(`terraform apply -auto-approve`, {
        env: {
            ...process.env,
        }
    });
}

export async function terraformDestroy() {
    console.log("📍Executing terraform destroy...")
    shell.exec(`terraform destroy -auto-approve`, {
        env: {
            ...process.env,
        }
    });
}

export async function terraformOutput() {
    console.log("📍Executing terraform output...")
    const {stdout} = shell.exec(`terraform output --json`, {
        env: {
            ...process.env,
        }
    });

    return stdout
}