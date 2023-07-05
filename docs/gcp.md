# GCP - SSH into VM Instances
Generate SSH Key Pair
- Run the following command to generate an SSH key pair: `ssh-keygen`

Update Environment Variables
- Open the .env file in your project.
- Locate the `TF_VAR_GCE_PUB_KEY_FILE` variable in .env file and set its value to the absolute path pointing to the public key file you generated.
- Locate the `PEM_FILE_PATH` variable in .env file and set its value to the absolute path pointing to the private key file you generated.

# Using Different TF_VAR_VM_NAME for Each Deployment
When deploying infrastructure with Terraform, it is recommended to use distinct `TF_VAR_VM_NAME` names for each deployment to ensure uniqueness and avoid conflicts.




