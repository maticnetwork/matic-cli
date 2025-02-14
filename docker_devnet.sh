#!/bin/bash

# Run the devnet - Consolidated script

# Start Anvil 
bash docker-anvil-start.sh || { echo "Failed to start Anvil"; exit 1; }

# Start Heimdall
bash docker-heimdall-start-all.sh || { echo "Failed to start Heimdall"; exit 1; }

# Setup Bor
bash docker-bor-setup.sh || { echo "Failed to setup Bor"; exit 1; }

# Start Bor
bash docker-bor-start-all.sh || { echo "Failed to start Bor"; exit 1; }

# Deploy dependency contracts on Anvil (L1)
bash anvil-deploy-dependencies.sh || { echo "Failed to deploy dependency contracts on Anvil"; exit 1; }

# Deploy mainnet contracts on Anvil (L1)
bash anvil-deployment.sh || { echo "Failed to deploy mainnet contracts on Anvil"; exit 1; }

# Setup validators on Anvil (L1)
bash anvil-stake.sh || { echo "Failed to setup validators on Anvil"; exit 1; }

# Deploy Bor contracts
bash anvil-deployment-bor.sh || { echo "Failed to deploy Bor contracts"; exit 1; }

# Sync Anvil deployments
bash anvil-deployment-sync.sh || { echo "Failed to sync Anvil deployments"; exit 1; }

echo "Devnet setup complete."
