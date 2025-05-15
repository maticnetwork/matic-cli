#!/bin/bash
set -e

IPC_PATH="/var/lib/bor/data/bor.ipc"

# Wait for the IPC file to exist
while ! docker exec bor0 test -S "$IPC_PATH"; do
  echo "Waiting for $IPC_PATH to be created..."
  sleep 5
done

while true; do
    peers=$(docker exec bor0 bor attach "$IPC_PATH" --exec 'admin.peers')
    block=$(docker exec bor0 bor attach "$IPC_PATH" --exec 'eth.blockNumber')

    if [[ -n "$peers" ]] && [[ -n "$block" ]]; then
        break
    fi
    echo "Waiting for Bor to respond..."
    sleep 5
done

echo "Peers: $peers"
echo "Block number: $block"
