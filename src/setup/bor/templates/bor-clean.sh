#!/usr/bin/env sh

set -x #echo on

ROOT_DIR=$PWD
DATA_DIR=${DATA_DIR:-$ROOT_DIR/data}
BOR_DATA_DIR=$DATA_DIR/bor/

rm -rf $BOR_DATA_DIR