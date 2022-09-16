const shell = require("shelljs");
const yaml = require('js-yaml');
const fs = require('fs');

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
  shell.cd('devnet');
  shell.exec(`../bin/matic-cli setup devnet -c ../configs/devnet/remote-setup-config.yaml`);
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
    
      default:
        console.log("Please use --init or --start or --destroy");
        break;
    }
}
  
