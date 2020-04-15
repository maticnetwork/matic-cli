#!/usr/bin/env sh

set -x #echo on

PRIVATE_KEY=$1

if [ -z "$PRIVATE_KEY" ]
  then
    echo "Private key is required as first argument"
  exit 1
fi

ROOT_DIR=$PWD
DATA_DIR=${DATA_DIR:-$ROOT_DIR/ganache-db}

ganache-cli --hardfork istanbul --blockTime 1 --db $DATA_DIR --account $PRIVATE_KEY,1000000000000000000000 --gasLimit 8000000 --gasPrice 0 -p 9545