# Cosmos-SDK Commit Testing Script

## Overview

This script automates the testing of specific commits from the [Cosmos SDK](https://github.com/maticnetwork/cosmos-sdk) within [Heimdall](https://github.com/maticnetwork/heimdall) using [Matic CLI](https://github.com/maticnetwork/matic-cli). It streamlines the process of:

- Checking out specific Cosmos SDK commits.
- Updating Heimdall's dependencies to these commits.
- Building the project to ensure compatibility.
- Deploying a devnet using Matic CLI to either cloud platforms (AWS/GCP) or locally via Docker.
- Collecting and storing logs for analysis.

By automating these tasks, the script significantly reduces manual overhead, enabling efficient and consistent testing of different Cosmos SDK versions within Heimdall.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Running the Script](#running-the-script)
  - [Platform Options](#platform-options)
- [Script Workflow](#script-workflow)
- [Logging](#logging)
- [Permissions](#permissions)

## Prerequisites

Before running the script, ensure you have the following installed and configured as specified in the [Matic CLI documentation](https://www.github.com/maticnetwork/matic-cli):

1. **Git**: For version control operations.
2. **Go**: To manage Go modules and build the project.
3. **Make**: For building the project.
4. **Docker**: If deploying locally using Docker.
5. **AWS CLI/GCP CLI**: If deploying on either of the cloud platforms.
6. **Terraform**: For config management and IaC required if using cloud based deployments.
7. **Access Rights**: Ensure you have the necessary permissions to push to the Heimdall branch specified in the configuration.

## Configuration

The script relies on a `config.env` file to set up necessary variables. This file is located at `matic-cli/util-scripts/heimdall/config.env`. Ensure this file is present and correctly configured.

### Sample `config.env`

```bash
# Array of Cosmos SDK commit hashes
cosmos_commits=(
  "commitHash1"
  "commitHash2"
  "commitHash3"
)

# Directories and branches
cosmos_directory="/Path/to/cosmos-sdk"       # Absolute path to your local Cosmos SDK directory
cosmos_branch="my-cosmos-branch"             # Branch name for Cosmos SDK commits
heimdall_directory="/Path/to/heimdall"       # Absolute path to your local Heimdall directory
heimdall_branch="my-heimdall-branch"         # Branch name for Heimdall (ensure you have push rights)
matic_cli_directory="/Path/to/matic-cli"     # Absolute path to your local Matic CLI directory
```

**Notes:**

- **`cosmos_commits`**: List the specific commit hashes from the Cosmos SDK repository you wish to test.
- **Directories**: Ensure all paths are absolute and correctly point to your local repositories.
- **Branches**:
  - `cosmos_branch`: The branch in the Cosmos SDK repository where the specified commits reside.
  - `heimdall_branch`: The branch in the Heimdall repository where dependencies will be updated. Ensure your docker `configs/devnet/docker-setup-config.yaml`(for local docker deployments) or your `.env`(for cloud based deployments) build using the same heimdall branch and you have the necessary permissions to push changes to this branch.

## Usage

### Running the Script

1. **Navigate to the Script Directory:**

   ```bash
   cd /Path/to/matic-cli/util-scripts/heimdall
   ```

2. **Make the Script Executable** (if not already):

   ```bash
   chmod +x cosmos_release_heimdall.sh
   ```

3. **Execute the Script** with the desired deployment platform:

   ```bash
   ./cosmos_release_heimdall.sh {aws|gcp|docker}
   ```

   Replace `{aws|gcp|docker}` with your target deployment platform.

### Platform Options

- **`aws`**: Deploy the devnet to Amazon Web Services.
- **`gcp`**: Deploy the devnet to Google Cloud Platform.
- **`docker`**: Deploy the devnet locally using Docker.

**Example:**

```bash
./cosmos_release_heimdall.sh aws
```

## Script Workflow

The script performs the following steps for each specified Cosmos SDK commit:

1. **Setup**:

   - Determines the script's directory.
   - Sources the `config.env` file for configuration variables.
   - Validates the provided deployment platform (`aws`, `gcp`, or `docker`).

2. **Processing Each Commit**:

   For each commit hash in `cosmos_commits`:

   a. **Checkout Cosmos SDK Commit**:

   - Navigates to the Cosmos SDK directory.
   - Fetches the latest changes.
   - Checks out the specified branch and pulls the latest commits.
   - Switches to the target commit.

   b. **Retrieve Version Information**:

   - Determines the module version corresponding to the commit.

   c. **Update Heimdall Dependencies**:

   - Navigates to the Heimdall directory.
   - Checks out or creates the specified Heimdall branch.
   - Updates `go.mod` to replace the Cosmos SDK dependency with the target version.
   - Runs `go mod tidy` and builds the project using `make heimdalld`.

   d. **Commit and Push Changes**:

   - Commits the updated `go.mod` and `go.sum`.
   - Pushes the changes to the Heimdall repository.

   e. **Deploy Devnet**:

   - Navigates to the Matic CLI directory.
   - Depending on the chosen platform (`aws`, `gcp`, or `docker`), initializes and starts the devnet.
   - Captures logs during initialization and deployment.
   - For Docker deployments, handles container cleanup and log collection.

   f. **Logging**:

   - Stores all logs in a structured directory for each commit and platform.

3. **Completion**:
   - After processing all commits, the script notifies that all tasks are completed.

## Logging

Logs are stored in the following structure within the Matic CLI repository:

```
matic-cli/util-scripts/heimdall/logs/
├── commitHash1/
│   ├── aws-init-commitHash1.log
│   ├── aws-start-commitHash1.log
│   ├── gcp-init-commitHash1.log
│   ├── gcp-start-commitHash1.log
│   ├── docker-setup-commitHash1.log
│   ├── docker-start-commitHash1.log
│   ├── bor/
│   │   └── ...
│   └── heimdall/
│       └── ...
├── commitHash2/
│   └── ...
└── commitHash3/
    └── ...
```

- **AWS/GCP Logs**: Capture initialization and startup logs specific to the cloud platform.
- **Docker Logs**: Include setup and startup logs, as well as logs from Bor and Heimdall nodes for local deployments.

These logs facilitate troubleshooting and analysis of each deployment.

## Permissions

- **Heimdall Branch**: Ensure you have push rights to the specified Heimdall branch (`heimdall_branch`) in your `config.env`. The script will attempt to commit and push changes to this branch.
- **Repository Access**: Ensure your local repositories (`cosmos_directory`, `heimdall_directory`, `matic_cli_directory`) are correctly set up with the necessary access rights.
- **Access and Setup**: Make sure you have AWS CLI or GCP CLI set up with the necessary permissions for cloud deployments.

---

_Happy Testing!_
