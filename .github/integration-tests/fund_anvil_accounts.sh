#!/bin/bash

echo "Transferring 10 ETH from account[0] to all others..."

signersFile="matic-cli/devnet/devnet/signer-dump.json"
signersDump=$(jq . $signersFile)
signersLength=$(jq '. | length' $signersFile)

rootChainWeb3="http://localhost:9545"

for ((i = 1; i < signersLength; i++)); do
  to_address=$(echo "$signersDump" | jq -r ".[$i].address")
  from_address=$(echo "$signersDump" | jq -r ".[0].address")
  txReceipt=$(curl $rootChainWeb3 -X POST --data '{"jsonrpc":"2.0","method":"eth_sendTransaction","params":[{"to":"'"$to_address"'","from":"'"$from_address"'","value":"8AC7230489E80000"}],"id":1}' -H "Content-Type: application/json")
  txHash=$(echo "$txReceipt" | jq -r '.result')
  echo "Funds transferred from $from_address to $to_address with txHash: $txHash"
done
