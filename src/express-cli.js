const shell = require("shelljs");

require('dotenv').config();

async function terrafromInit(){
  shell.exec(`terraform init`, {
    env: {
      ...process.env,
    }
  });
}

async function terrafromApply(){
  shell.exec(`terraform apply -auto-approve`, {
    env: {
      ...process.env,
    }
  });
}

async function terrafromDestroy(){
  shell.exec(`terraform destroy -auto-approve`, {
    env: {
      ...process.env,
    }
  });
}

// start CLI
export async function cli(args) {
    console.log("Using Express CLI 🚀");

    switch (args[2]) {
      case "--start":
        await terrafromApply();
        break;

      case "--destroy":
        await terrafromDestroy();
        break;
      
      case "--init":
        await terrafromInit();
        break;
    
      default:
        console.log("Please use --init or --start or --destroy");
        break;
    }
}
  
