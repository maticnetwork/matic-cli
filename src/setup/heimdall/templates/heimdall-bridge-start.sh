#!/usr/bin/env sh

set -x #echo on

ROOT_DIR=$PWD
DATA_DIR=${DATA_DIR:-$ROOT_DIR/data}
HEIMDALL_HOME_DIR=$DATA_DIR/heimdall
CODE_DIR=${CODE_DIR:-$ROOT_DIR/code}
HEIMDALL_CODE_DIR=$CODE_DIR/heimdall
BUILD_DIR=$HEIMDALL_CODE_DIR/build

$BUILD_DIR/bridge --home $HEIMDALL_HOME_DIR start --all