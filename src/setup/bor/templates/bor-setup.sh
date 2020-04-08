#!/usr/bin/env sh

set -x #echo on

ROOT_DIR=$PWD
DATA_DIR=${DATA_DIR:-$ROOT_DIR/data}
BOR_DATA_DIR=$DATA_DIR/bor/
BUILD_DIR=$PWD/bor/build/bin
GENESIS_DIR=${GENESIS_DIR:-genesis-contracts}

# create bor, logs and keystore directory
mkdir -p $DATA_DIR/logs
mkdir -p $DATA_DIR/keystore

# init bor
$BUILD_DIR/bor --datadir $BOR_DATA_DIR init $ROOT_DIR/$GENESIS_DIR/genesis.json

echo "Setup done!"