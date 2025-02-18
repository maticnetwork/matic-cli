#!/bin/bash

# Run the devnet - Consolidated script

# Start ganache
bash docker-ganache-start.sh || { echo "Failed to start Ganache"; exit 1; }

# Start Heimdall
bash docker-heimdall-start-all.sh || { echo "Failed to start Heimdall"; exit 1; }

# Setup Bor
bash docker-bor-setup.sh || { echo "Failed to setup Bor"; exit 1; }

# Start Bor
bash docker-bor-start-all.sh || { echo "Failed to start Bor"; exit 1; }

sleep 2m

# Deploy Bor to Ganache
bash ganache-deployment-bor.sh || { echo "Failed to deploy Bor to Ganache"; exit 1; }

# Sync Ganache deployment
bash ganache-deployment-sync.sh || { echo "Failed to sync Ganache deployment"; exit 1; }

echo "Devnet setup complete."
