#!/usr/bin/env sh

set -x #echo on

# private key
PRIVATE_KEY=$1

if [ -z "$PRIVATE_KEY" ]
  then
    echo "Private key is required as first argument"
  exit 1
fi


# heimdall id
export HEIMDALL_ID=$2

if [ -z "$2" ]
  then
    echo "Heimdall id is required as first argument"
  exit 1
fi

ROOT_DIR=$PWD

# cd matic contracts
cd $ROOT_DIR/code/matic-contracts

# migrations
mv migrations dev-migrations && cp -r deploy-migrations migrations

# root contracts are deployed on base chain
npm run truffle:migrate -- --reset --to 3 --network development