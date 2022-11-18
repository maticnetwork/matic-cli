import yaml from "js-yaml";
import fs from "fs";
import os from "os"

export async function loadConfig(devnetType, devnetId) {
    let doc
    if (devnetId !== -1) {
        if (!fs.existsSync(`./deployments/devnet-${devnetId}/${devnetType}-setup-config.yaml`)) {
            console.log("❌ Config file for the devnet Id doesn't exist")
            process.exit(1)
        }
        doc = await yaml.load(fs.readFileSync(`./deployments/devnet-${devnetId}/${devnetType}-setup-config.yaml`, 'utf-8'))
    } else {
        doc = await yaml.load(fs.readFileSync(`./configs/devnet/${devnetType}-setup-config.yaml`, 'utf8'));
    }

    return doc
}

export async function editMaticCliRemoteYAMLConfig() {

    console.log("📍Editing matic-cli remote YAML configs...")

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'), undefined);

    setCommonConfigs(doc)
    setConfigList('devnetBorHosts', process.env.DEVNET_BOR_HOSTS, doc);
    setConfigList('devnetHeimdallHosts', process.env.DEVNET_BOR_HOSTS, doc);
    setConfigList('devnetBorUsers', process.env.DEVNET_BOR_USERS, doc);
    setConfigList('devnetHeimdallUsers', process.env.DEVNET_BOR_USERS, doc);
    setConfigValue('devnetType', 'remote', doc)

    fs.writeFile('./configs/devnet/remote-setup-config.yaml', yaml.dump(doc), (err) => {
        if (err) {
            console.log("❌ Error while writing remote YAML configs: \n", err)
            process.exit(1)
        }
    });
}

export async function editMaticCliDockerYAMLConfig() {

    console.log("📍Editing matic-cli docker YAML configs...")

    let doc = await yaml.load(fs.readFileSync('./configs/devnet/docker-setup-config.yaml', 'utf8'), undefined);

    setCommonConfigs(doc)
    setEthHostUser('ubuntu', doc)
    setConfigList('devnetBorHosts', process.env.DEVNET_BOR_HOSTS, doc);
    setConfigValue('devnetBorUsers', process.env.DEVNET_BOR_USERS, doc)
    setConfigValue('devnetType', 'docker', doc)
    setEthURL('ganache', doc);

    fs.writeFile('./configs/devnet/docker-setup-config.yaml', yaml.dump(doc), (err) => {
        if (err) {
            console.log("❌ Error while writing docker YAML configs: \n", err)
            process.exit(1)
        }
    });
}


export function setCommonConfigs(doc) {
    setConfigValue('defaultStake', parseInt(process.env.DEFAULT_STAKE), doc);
    setConfigValue('defaultFee', parseInt(process.env.DEFAULT_FEE), doc);
    setConfigValue('borChainId', parseInt(process.env.BOR_CHAIN_ID), doc);
    setConfigValue('heimdallChainId', process.env.HEIMDALL_CHAIN_ID, doc);
    setConfigValue('sprintSize', parseInt(process.env.SPRINT_SIZE), doc);
    setConfigValue('blockNumber', process.env.BLOCK_NUMBER, doc);
    setConfigValue('blockTime', process.env.BLOCK_TIME, doc);
    setConfigValue('borBranch', process.env.BOR_BRANCH, doc);
    setConfigValue('heimdallBranch', process.env.HEIMDALL_BRANCH, doc);
    setConfigValue('contractsBranch', process.env.CONTRACTS_BRANCH, doc);
    setConfigValue('genesisContractsBranch', process.env.GENESIS_CONTRACTS_BRANCH, doc)
    setConfigValue('numOfValidators', parseInt(process.env.TF_VAR_VALIDATOR_COUNT), doc);
    setConfigValue('numOfNonValidators', parseInt(process.env.TF_VAR_SENTRY_COUNT), doc);
    setConfigValue('ethHostUser', process.env.ETH_HOST_USER, doc);
    setConfigValue('borDockerBuildContext', process.env.BOR_DOCKER_BUILD_CONTEXT, doc);
    setConfigValue('heimdallDockerBuildContext', process.env.HEIMDALL_DOCKER_BUILD_CONTEXT, doc);
}

export function fetchAndUpdateDevnetId() {
    let id = process.env.DEVNET_ID 
    if (typeof id === "undefined") {
        id = 0
    }

    process.env.DEVNET_ID = parseInt(id, 10) + 1

    const ENV_VARS = fs.readFileSync(".env", "utf8").split(os.EOL);

    const target = ENV_VARS.indexOf(ENV_VARS.find((line) => {
     const keyValRegex = new RegExp(`(?<!#\\s*)DEVNET_ID(?==)`);
        return line.match(keyValRegex);
     }));

    if (target !== -1) {
        ENV_VARS.splice(target, 1, `DEVNET_ID=${process.env.DEVNET_ID} # Monotonically increasing count to track the devnets being deployed`);
    } else {
        ENV_VARS.push(`\nDEVNET_ID=${process.env.DEVNET_ID} # Monotonically increasing count to track the devnets being deployed`);
    }

    fs.writeFileSync(".env", ENV_VARS.join(os.EOL));

    return id
}

export function fetchPrevDevnetType() {

    const ENV_VARS = fs.readFileSync(".env", "utf8").split(os.EOL);

    const target = ENV_VARS.indexOf(ENV_VARS.find((line) => {
     const keyValRegex = new RegExp(`(?<!#\\s*)PREV_DEVNET_TYPE(?==)`);
        return line.match(keyValRegex);
     }));

    if (target !== -1) {
        return process.env.PREV_DEVNET_TYPE
    } else {
        ENV_VARS.push(`\nPREV_DEVNET_TYPE= # Track the devnet type. DO NOT EDIT THIS!`);
        fs.writeFileSync(".env", ENV_VARS.join(os.EOL));
        
        return
    }

}

export function updateDevnetType(devnetType) {
    process.env.PREV_DEVNET_TYPE = devnetType
    const ENV_VARS = fs.readFileSync(".env", "utf8").split(os.EOL);

    const target = ENV_VARS.indexOf(ENV_VARS.find((line) => {
     const keyValRegex = new RegExp(`(?<!#\\s*)PREV_DEVNET_TYPE(?==)`);
        return line.match(keyValRegex);
     }));

    if (target !== -1) {
        ENV_VARS.splice(target, 1, `PREV_DEVNET_TYPE=${process.env.PREV_DEVNET_TYPE} # Track the devnet type. DO NOT EDIT THIS!`);

    }

    fs.writeFileSync(".env", ENV_VARS.join(os.EOL));
}

export function setConfigValue(key, value, doc) {
    if (value !== undefined) {
        doc[key] = value;
    }
}

export function setConfigList(key, value, doc) {
    if (value !== undefined) {
        value = value.split(' ').join('')
        const valueArray = value.split(",");
        if (valueArray.length > 0) {
            doc[key] = []
            for (let i = 0; i < valueArray.length; i++) {
                doc[key][i] = valueArray[i];

                if (i === 0) {
                    if (key === 'devnetBorHosts') {
                        setEthURL(valueArray[i], doc);
                    }
                    if (key === 'devnetBorUsers') {
                        setEthHostUser(valueArray[i], doc);
                    }
                }
            }
        }
    }
}

export function setEthURL(value, doc) {
    if (value !== undefined) {
        doc['ethURL'] = 'http://' + value + ':9545';
        process.env.ETH_URL = doc['ethURL']
    }
}

export function setEthHostUser(value, doc) {
    if (value !== undefined) {
        doc['ethHostUser'] = value;
    }
}

export function splitToArray(value) {
    try {
        return value.split(' ').join('').split(",")
    } catch (error) {
        console.error("📍Failed to split to IP array: ", error);
        console.log("📍Exiting...");
        process.exit(1)
    }
    
}

export function splitAndGetHostIp(value) {
    try {
        return value.split("@")[0]
    } catch (error) {
        console.error("📍Failed to split IP: ", error);
        console.log("📍Exiting...");
        process.exit(1)
    }
}

export async function checkAndReturnVMIndex(n, doc) {

    if (typeof n === "boolean") {
        console.log("📍Targeting all VMs ...");
        return undefined
    }

    if (typeof n === "string") {
        let vmIndex = parseInt(n, 10)
        if (vmIndex >= 0 && vmIndex < doc['devnetBorHosts'].length) {
            console.log(`📍Targeting VM with IP ${doc['devnetBorHosts'][vmIndex]} ...`);
            return vmIndex
        } else {
            console.log("📍Wrong VM index, please check your configs! Exiting...");
            process.exit(1)
        }
    }
}
