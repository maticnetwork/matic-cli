#!/usr/bin/env sh

NODE_DIR=$HOME/node
BOR_HOME=$HOME/.bor
BIN_DIR=$(go env GOPATH)/bin
USER=$(whoami)


VALIDATOR_ADDRESS="`cat $BOR_HOME/address.txt`"

cat > metadata <<EOF
VALIDATOR_ADDRESS=
EOF

cat > ganache.service <<EOF
[Unit]
    Description=ganache
[Service]
    WorkingDirectory=$HOME
    Environment=PATH=/home/ubuntu/.nvm/versions/node/v10.17.0/bin:/home/ubuntu/go/bin:/home/ubuntu/.go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin
    ExecStart=/bin/bash $HOME/ganache-start-remote.sh
    User=ubuntu
    Type=simple
    KillSignal=SIGINT
EOF

cat > bor.service <<EOF
[Unit]
  Description=bor
  StartLimitIntervalSec=500
  StartLimitBurst=5
[Service]
  Restart=on-failure
  RestartSec=5s
  WorkingDirectory=$NODE_DIR
  Environment=PATH=/home/ubuntu/.nvm/versions/node/v10.17.0/bin:/home/ubuntu/go/bin:/home/ubuntu/.go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin
  EnvironmentFile=$HOME/metadata
  ExecStartPre=/bin/bash $NODE_DIR/bor-setup.sh 
  ExecStart=/bin/bash $NODE_DIR/bor-start.sh $VALIDATOR_ADDRESS
  Type=simple
  User=$USER
  KillSignal=SIGINT
  TimeoutStopSec=120
[Install]
  WantedBy=multi-user.target
EOF

cat > heimdalld.service <<EOF
[Unit]
  Description=heimdalld
[Service]
  WorkingDirectory=$NODE_DIR
  ExecStartPre=/bin/bash $NODE_DIR/heimdalld-setup.sh 
  ExecStart=$BIN_DIR/heimdalld start --home $HOME/.heimdalld --chain=$HOME/.heimdalld/config/genesis.json  --bridge --all --rest-server
  Type=simple
  User=$USER
[Install]
  WantedBy=multi-user.target
EOF

cat > heimdalld-rest-server.service <<EOF
[Unit]
  Description=heimdalld-rest-server
[Service]
  WorkingDirectory=$NODE_DIR
  ExecStart=$BIN_DIR/heimdalld rest-server
  Type=simple
  User=$USER
[Install]
  WantedBy=multi-user.target
EOF

cat > heimdalld-bridge.service <<EOF
[Unit]
  Description=heimdalld-bridge
[Service]
  WorkingDirectory=$NODE_DIR
  ExecStart=$BIN_DIR/bridge start --all
  Type=simple
  User=$USER
[Install]
  WantedBy=multi-user.target
EOF