#!/usr/bin/env sh

set -x #echo on

# private key
ADDRESS=$1

if [ -z "$ADDRESS" ]
  then
    echo "Address is required as first argument"
  exit 1
fi

# private key
PUB_KEY=$2

if [ -z "$PUB_KEY" ]
  then
    echo "Pub key is required as second argument"
  exit 1
fi

ROOT_DIR=$PWD

# cd matic contracts
cd $ROOT_DIR/matic-contracts

# root contracts are deployed on base chain
npm run truffle exec scripts/stake.js -- --network development $ADDRESS 10000 $PUB_KEY