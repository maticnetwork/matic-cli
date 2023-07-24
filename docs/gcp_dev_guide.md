# Google Cloud SDK (gcloud) Installation

- Visit the Google Cloud SDK installation page: https://cloud.google.com/sdk/docs/install. Follow the installation instructions specific to your operating system. 
- Run the following command to verify that the SDK installed correctly:
  `gcloud version`
- Run the following command to start the initialization process:
  `gcloud init`
- Authenticate with Application Default Credentials:
  `gcloud auth application-default login`
- After initialization, run: `gcloud config set project YOUR_PROJECT_ID` (Replace YOUR_PROJECT_ID with your actual GCP project ID)

# express-cli on GCP

- Make sure you have installed `gcloud` tool for authentication
- You also need `ssh-keygen` tool. It's mostly available in all distributions.
- You should have a public and private keypair for running ssh commands. You can generate one using following commands
  `sh
ssh-keygen -f ~/ubuntu.pem -N ""
`
  The above command will generates the public key named _ubuntu.pem.pub_ and the private key named _ubuntu.pem_ in home directory.
- In `.env` file, you have update with correct details. You can ignore AWS specific terraform variables.

## GCP - SSH configuration

- If you don't have a keypair, run the following command to generate an SSH key pair: `ssh-keygen -f ubuntu.pem -N ""`
- The above command generates two files. _ubuntu.pem_ (private keyfile) and _ubuntu.pem.pub_ (public key)
- These two files have to be updated in _.env_ file.
- Locate the `TF_VAR_GCE_PUB_KEY_FILE` variable in .env file and set its value to the absolute path pointing to the public key file you generated.
- Locate the `PEM_FILE_PATH` variable in .env file and set its value to the absolute path pointing to the private key file you generated.

## Resource Naming Convention

- GCP identifies the resources using names. So every resource should have a unique name.
- When deploying resources in GCP, we are using `TF_VAR_VM_NAME` names as prefix for each resource to ensure uniqueness and avoid conflicts.
- So for every devnet you provision, make sure to update the `TF_VAR_VM_NAME` in _.env_.
