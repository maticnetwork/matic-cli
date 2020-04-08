#!/usr/bin/env sh

set -x #echo on

ADDRESS=$1
BOR_CHAIN_ID=$2

if [ -z "$ADDRESS" ]
  then
    echo "Address is required as first argument"
  exit 1
fi

if [ -z "$BOR_CHAIN_ID" ]
  then
    echo "Chain id is required as second argument"
  exit 1
fi

ROOT_DIR=$PWD
DATA_DIR=${DATA_DIR:-$ROOT_DIR/data}
BOR_DATA_DIR=$DATA_DIR/bor/
BUILD_DIR=$PWD/bor/build/bin
GENESIS_DIR=${GENESIS_DIR:-genesis-contracts}

mkdir -p $BOR_DIR/logs

$BUILD_DIR/bor --datadir $BOR_DATA_DIR \
  --port 30303 \
  --rpc --rpcaddr '0.0.0.0' \
  --rpcvhosts '*' \
  --rpccorsdomain '*' \
  --rpcport 8545 \
  --ipcpath $BOR_DATA_DIR/bor.ipc \
  --rpcapi 'db,eth,net,web3,txpool' \
  --networkid $BOR_CHAIN_ID \
  --gasprice '0' \
  --keystore $DATA_DIR/keystore \
  --unlock $ADDRESS \
  --password $DATA_DIR/password.txt \
  --allow-insecure-unlock \
  --maxpeers 200 \
  --metrics \
  --pprof --pprofport 7071 --pprofaddr '0.0.0.0' \
  --mine