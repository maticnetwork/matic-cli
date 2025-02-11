#!/bin/bash

# Determine the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source the configuration file
if [ -f "$SCRIPT_DIR/config.env" ]; then
    source "$SCRIPT_DIR/config.env"
else
    echo "config.env file not found in $SCRIPT_DIR!"
    exit 1
fi

# Check if an option is provided
if [ -z "$1" ]; then
    echo "Usage: $0 {aws|gcp|docker}"
    exit 1
fi

# Set the platform based on the option provided
platform="$1"

# Validate the platform option
case $platform in
    aws|gcp|docker)
        echo "Selected platform: $platform"
        ;;
    *)
        echo "Invalid platform option: $platform. Use 'aws', 'gcp', or 'docker'."
        exit 1
        ;;
esac

# Define the log destination base directly
log_destination_base="$matic_cli_directory/util-scripts/heimdall/logs"

# Iterate over each commit
for commit_hash in "${cosmos_commits[@]}"; do
    echo "========================================"
    echo "Processing commit: $commit_hash"
    echo "========================================"

    # Step 1: Check out the Cosmos SDK commit
    cd "$cosmos_directory" || exit 1
    git fetch origin
    git checkout "$cosmos_branch" || exit 1
    git pull origin "$cosmos_branch"
    git checkout "$commit_hash" || exit 1

    # Step 2: Get the version corresponding to the commit
    version_output=$(go list -m github.com/maticnetwork/cosmos-sdk@"$commit_hash" 2>/dev/null)
    if [ $? -ne 0 ]; then
        echo "Failed to get version for commit $commit_hash"
        exit 1
    fi
    version=$(echo "$version_output" | awk '{print $2}')
    echo "Found version: $version for commit $commit_hash"

    # Step 3: Update Heimdall's go.mod
    cd "$heimdall_directory" || exit 1

    git fetch origin
    git checkout -b "$heimdall_branch" || git checkout "$heimdall_branch"

    # Replace cosmos-sdk with testing version
    sed -i.bak "s|replace github.com/cosmos/cosmos-sdk .*|replace github.com/cosmos/cosmos-sdk => github.com/maticnetwork/cosmos-sdk $version|" go.mod

    # Clean up backup file created by sed (macOS)
    rm go.mod.bak

    # Run go mod tidy
    go mod tidy || { echo "go mod tidy failed"; exit 1; }

    # Run make build
    make heimdalld || { echo "make heimdalld failed"; exit 1; }

    # Step 4: Commit and push changes
    git add go.mod go.sum
    git commit -m "Update cosmos-sdk to version $version for commit $commit_hash"
    git push origin "$heimdall_branch"

    # Step 5: Build and run the devnet using matic-cli
    cd "$matic_cli_directory" || exit 1

    case $platform in
        aws)
            # Ensure the logs directory exists
            log_destination="$log_destination_base/$commit_hash"
            mkdir -p "$log_destination"
            echo "Running AWS specific setup..."

            # Run init and capture logs
            ./bin/express-cli.js --init aws | tee "$log_destination/aws-init-$commit_hash.log"

            echo "Init completed. Finding the highest devnet directory..."

            # Find the highest-numbered devnet-X directory
            highest_devnet=$(ls -d deployments/devnet-* 2>/dev/null | sort -V | tail -n 1)

            if [ -z "$highest_devnet" ]; then
                echo "No devnet directories found. Exiting..."
                exit 1
            fi

            echo "Navigating to latest devnet directory: $highest_devnet"
            cd "$highest_devnet" || exit 1

            # Start the devnet and capture logs
            ../../bin/express-cli.js --start | tee "$log_destination/aws-start-$commit_hash.log"
            ;;
        gcp)
            # Ensure the logs directory exists
            log_destination="$log_destination_base/$commit_hash"
            mkdir -p "$log_destination"
            echo "Running GCP specific setup..."

            # Run init and capture logs
            ./bin/express-cli.js --init gcp | tee "$log_destination/gcp-init-$commit_hash.log"

            echo "Init completed. Finding the highest devnet directory..."

            # Find the highest-numbered devnet-X directory
            highest_devnet=$(ls -d deployments/devnet-* 2>/dev/null | sort -V | tail -n 1)

            if [ -z "$highest_devnet" ]; then
                echo "No devnet directories found. Exiting..."
                exit 1
            fi

            echo "Navigating to latest devnet directory: $highest_devnet"
            cd "$highest_devnet" || exit 1

            # Start the devnet and capture logs
            ../../bin/express-cli.js --start | tee "$log_destination/gcp-start-$commit_hash.log"
            ;;
        docker)
            # Ensure the logs directory exists
            mkdir -p "$log_destination_base"
            echo "Running Docker specific setup..."

            # Log locations in matic-cli devnet
            bor_log_source="$matic_cli_directory/devnet/logs/node0/bor/"
            heimdall_log_source="$matic_cli_directory/devnet/logs/node0/heimdall/"
            log_destination="$log_destination_base/$commit_hash"
            mkdir -p "$log_destination"

            # Clean up any existing Docker containers and devnet directory
            docker stop $(docker ps -q) 2>/dev/null
            docker rm $(docker ps -a -q) 2>/dev/null
            rm -rf devnet
            mkdir devnet
            cd devnet || exit 1
            ../bin/matic-cli.js setup devnet --config ../configs/devnet/docker-setup-config.yaml | tee "$log_destination/docker-setup-$commit_hash.log"

            # Start the devnet using the aggregated script
            chmod +x ../docker_devnet.sh
            ../docker_devnet.sh | tee "$log_destination/docker-start-$commit_hash.log"

            # Copy logs to the specified location
            mkdir -p "$log_destination/bor"
            mkdir -p "$log_destination/heimdall"

            cp -r "$bor_log_source"* "$log_destination/bor/"
            cp -r "$heimdall_log_source"* "$log_destination/heimdall/"

            echo "Logs copied to $log_destination"

            # Clean up
            cd "$matic_cli_directory" || exit 1
            docker stop $(docker ps -q) 2>/dev/null
            docker rm $(docker ps -a -q) 2>/dev/null
            rm -rf devnet

            ;;
    esac

    echo "Completed processing for commit: $commit_hash"
    echo "========================================"
done

echo "All commits have been processed."
