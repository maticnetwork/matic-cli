#!/bin/bash

host='localhost'

echo "Transferring 10 ETH from anvil account[0] to all others..."

signersFile="../devnet/devnet/signer-dump.json"
signersDump=$(jq . $signersFile)
signersLength=$(jq '. | length' $signersFile)

rootChainWeb3="http://${host}:9545"

for ((i = 1; i < signersLength; i++)); do
  to_address=$(echo "$signersDump" | jq -r ".[$i].address")
  from_address=$(echo "$signersDump" | jq -r ".[0].address")
  from_priv_key=$(echo "$signersDump" | jq -r ".[0].priv_key")
  txReceipt=$(cast send --rpc-url $rootChainWeb3 --private-key $from_priv_key $to_address --value 10ether)
  txHash=$(echo "$txReceipt" | grep -oE '0x[a-fA-F0-9]{64}' | head -n 1)
  echo "Funds transferred from $from_address to $to_address with txHash: $txHash"
done
