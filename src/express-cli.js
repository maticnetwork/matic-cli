const shell = require("shelljs");
const yaml = require('js-yaml');
const fs = require('fs');
const fetch = require('node-fetch');

require('dotenv').config();
var doc = {}

const timer = ms => new Promise(res => setTimeout(res, ms))

async function terraformInit(){
  shell.exec(`terraform init`, {
    env: {
      ...process.env,
    }
  });
}

async function terraformApply(){
  shell.exec(`terraform apply -auto-approve`, {
    env: {
      ...process.env,
    }
  });
}

async function terraformDestroy(){
  shell.exec(`terraform destroy -auto-approve`, {
    env: {
      ...process.env,
    }
  });
}

async function terraformOutput(){
  var {stdout} = shell.exec(`terraform output --json`, {
    env: {
      ...process.env,
    }
  });

  return stdout
}

function setConfigValue(key, value){
  if(value){
    doc[key] = value;
  }
}

async function rmDevnet(){
  shell.exec(`rm -rf devnet`);
}

async function runMaticCLI(){
  shell.exec(`mkdir devnet`);
  shell.pushd('devnet');
  shell.exec(`../bin/matic-cli setup devnet -c ../configs/devnet/remote-setup-config.yaml`);
  shell.popd();
}

function sshSetup(){
  shell.exec('eval "$(ssh-agent -s)"')
  shell.exec(`ssh-add ${process.env.PEM_FILE_PATH}`)
}

function setConfigList(key, value){
  if(value){
    value = value.split(' ').join('')
    var valueArray = value.split(",")
    if(valueArray.length > 0){
      doc[key] = []
      for (var i = 0; i < valueArray.length; i++) {
        doc[key][i] = valueArray[i];
        
        if(i===0){
          if(key==='devnetBorHosts'){
            setEthURL(valueArray[i]);
          }
          if(key==='devnetBorUsers'){
            setEthHostUser(valueArray[i]);
          }
        }
      }
    }
  }
}

function setEthURL(value){
  if(value){
    doc['ethURL']='http://'+value+':9545';
  }
}

function setEthHostUser(value){
  if(value){
    doc['ethHostUser'] = value;
  }
}

async function startStressTest(){
  shell.pushd("tests/stress-test");
  shell.exec(`go mod tidy`);
  shell.exec(`go run main.go`, {
    env: {
      ...process.env,
    }
  });
  shell.popd();
}

async function editRemoteYAMLConfig(){
  doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));

  setConfigValue('defaultStake', parseInt(process.env.DEFAULT_STAKE));
  setConfigValue('defaultFee', parseInt(process.env.DEFAULT_FEE));
  setConfigValue('borChainId', parseInt(process.env.BOR_CHAIN_ID));
  setConfigValue('heimdallChainId', process.env.HEIMDALL_CHAIN_ID);
  setConfigValue('borBranch', process.env.BOR_BRANCH);
  setConfigValue('heimdallBranch', process.env.HEIMDALL_BRANCH);
  setConfigValue('contractsBranch', process.env.CONTRACTS_BRANCH);
  setConfigValue('numOfValidators', parseInt(process.env.TF_VAR_VALIDATOR_COUNT));
  setConfigValue('numOfNonValidators', parseInt(process.env.TF_VAR_SENTRY_COUNT));
  setConfigValue('devnetType', process.env.DEVNET_TYPE);

  setConfigList('devnetBorHosts', process.env.DEVNET_BOR_HOSTS);
  setConfigList('devnetHeimdallHosts', process.env.DEVNET_BOR_HOSTS);
  setConfigList('devnetBorUsers', process.env.DEVNET_BOR_USERS);
  setConfigList('devnetHeimdallUsers', process.env.DEVNET_BOR_USERS);

  fs.writeFile('./configs/devnet/remote-setup-config.yaml', yaml.dump(doc), (err) => {
    if (err) {
        console.log(err);
    }
});
}

async function sendStateSyncTx(){
  let contractAddresses = require('../devnet/code/contracts/contractAddresses.json');
  let MaticToken = contractAddresses.root.tokens.MaticToken;

  shell.pushd("devnet/code/contracts");
  shell.exec(`npm run truffle exec scripts/deposit.js -- --network development ${MaticToken} 100000000000000000000`)
  shell.popd();
}

async function checkCheckpoint(machine0){
  let url = `http://${machine0}:1317/checkpoints/count`;
  let response = await fetch(url);
  let responseJson = await response.json();
  if (responseJson.result){
    if(responseJson.result.result){
      let count = responseJson.result.result
      return count
    }
  }

  return 0
}

async function checkStateSyncTx(machine0){
  let url = `http://${machine0}:1317/clerk/event-record/1`;
  let response = await fetch(url);
  let responseJson = await response.json();
  if(responseJson.error){
    return undefined
  }else{
    if(responseJson.result){
      return responseJson.result.tx_hash
    }
  }

  return undefined
}

async function monitor(){
  doc = await yaml.load(fs.readFileSync('./configs/devnet/remote-setup-config.yaml', 'utf8'));
  if(doc['devnetBorHosts'].length>0){
    console.log("Monitoring the first node", doc['devnetBorHosts'][0]);
  }
  let machine0 = doc['devnetBorHosts'][0];
  console.log("Checking for statesyncs && Checkpoints")

  while(true){
    
    await timer(1000);
    console.log()

    let checkpointCount = await checkCheckpoint(machine0);
    if (checkpointCount > 0) {
      console.log("Checkpoint found ✅ ; Count: ", checkpointCount);
    }else{
      console.log("Awaiting Checkpoint 🚌")
    }


   let stateSyncTx = await checkStateSyncTx(machine0);
   if (stateSyncTx){
    console.log("Statesync found ✅ ; Tx_Hash: ", stateSyncTx);
   }else{
    console.log("Awaiting Statesync 🚌")
    }

    if (checkpointCount > 0 && stateSyncTx){
      break;
    }

  }
}

// start CLI
export async function cli(args) {
    console.log("Using Express CLI 🚀");

    switch (args[2]) {
      case "--start":
        await terraformApply();
        sshSetup() // add ssh-keys in the config
        let terraOut = await terraformOutput();
        let ips = JSON.parse(terraOut).instance_ips.value;
        process.env.DEVNET_BOR_HOSTS = ips.toString();

        await editRemoteYAMLConfig();
        await timer(1000) // wait for 1 second
        await runMaticCLI();
        break;

      case "--destroy":
        await terraformDestroy();
        await rmDevnet();
        break;
      
      case "--init":
        await terraformInit();
        break;

      case "--stress":
        await startStressTest();
        break;
      
      case "--send-state-sync":
        await sendStateSyncTx();
        break;

      case "--monitor":
        await monitor();
        break;
    
      default:
        console.log("Please use --init or --start or --destroy");
        break;
    }
}
  
