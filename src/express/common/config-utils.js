import yaml from "js-yaml";
import fs from "fs";

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
    setEthURL('ganache', doc);
    setConfigList('devnetBorHosts', process.env.DEVNET_BOR_HOSTS, doc);
    setConfigValue('devnetBorUsers', process.env.DEVNET_BOR_USERS, doc)
    setConfigValue('devnetType', 'docker', doc)

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
    setConfigValue('numOfValidators', parseInt(process.env.TF_VAR_VALIDATOR_COUNT), doc);
    setConfigValue('numOfNonValidators', parseInt(process.env.TF_VAR_SENTRY_COUNT), doc);
    setConfigValue('ethHostUser', process.env.ETH_HOST_USER, doc);
    setConfigValue('borDockerBuildContext', process.env.BOR_DOCKER_BUILD_CONTENXT, doc);
    setConfigValue('heimdallDockerBuildContext', process.env.HEIMDALL_DOCKER_BUILD_CONTENXT, doc);
}

export function setConfigValue(key, value, doc) {
    if (value) {
        doc[key] = value;
    }
}

export function setConfigList(key, value, doc) {
    if (value) {
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
    if (value) {
        doc['ethURL'] = 'http://' + value + ':9545';
        process.env.ETH_URL = doc['ethURL']
    }
}

export function setEthHostUser(value, doc) {
    if (value) {
        doc['ethHostUser'] = value;
    }
}

export function splitToArray(value) {
    return value.split(' ').join('').split(",")
}

