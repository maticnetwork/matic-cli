#!/usr/bin/env sh

INDEX=$1

docker-compose run -d --service-ports --name heimdall$INDEX heimdall$INDEX sh -c "
heimdalld start > ./logs/heimdalld.log 2>&1 &
heimdalld rest-server > ./logs/heimdalld-rest-server.log 2>&1 &
sleep 60 && bridge start --all > ./logs/bridge.log 2>&1 &
tail -f ./logs/heimdalld.log ./logs/heimdalld-rest-server.log ./logs/bridge.log
"
