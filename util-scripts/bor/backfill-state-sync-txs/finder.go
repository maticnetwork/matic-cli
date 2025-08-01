package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/ethereum/go-ethereum/common"
)

/*

This script gets all the blocks in which state sync txns are present on Matic pos mainnnet chain from polygonscan. It then checks if there are any difference between the no of txns in these blocks on local node vs remote rpc url and reports such occurrences.

Mainnet API for getting all state sync txs:
https://api.polygonscan.com/api?module=account&action=txlist&address=0x0000000000000000000000000000000000000000&startblock=1&endblock=99999999&page=1&offset=1000&sort=asc&apikey=YourApiKeyToken


https://api.polygonscan.com/api?module=account&action=txlist&address=0x0000000000000000000000000000000000000000&startblock=1&endblock=1000&page=1&offset=1000&sort=asc



1. Get all state sync txs in a block range from polygonscan
2. For these txs, check if we have these txs in our localhost bor rpc
3. If no, append output to a file

*/

type PolygonScanResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Result  []struct {
		BlockNumber       string `json:"blockNumber"`
		TimeStamp         string `json:"timeStamp"`
		Hash              string `json:"hash"`
		Nonce             string `json:"nonce"`
		BlockHash         string `json:"blockHash"`
		TransactionIndex  string `json:"transactionIndex"`
		From              string `json:"from"`
		To                string `json:"to"`
		Value             string `json:"value"`
		Gas               string `json:"gas"`
		GasPrice          string `json:"gasPrice"`
		IsError           string `json:"isError"`
		TxreceiptStatus   string `json:"txreceipt_status"`
		Input             string `json:"input"`
		ContractAddress   string `json:"contractAddress"`
		CumulativeGasUsed string `json:"cumulativeGasUsed"`
		GasUsed           string `json:"gasUsed"`
		Confirmations     string `json:"confirmations"`
	} `json:"result"`
}

type Tx struct {
	BlockNumber string
	BlockHash   string
	Hash        string
}

type TxResponse struct {
	Jsonrpc string            `json:"jsonrpc"`
	ID      int               `json:"id"`
	Result  *TxResponseResult `json:"result"`
}

type TxResponseResult struct {
	BlockHash        string `json:"blockHash"`
	BlockNumber      string `json:"blockNumber"`
	From             string `json:"from"`
	Gas              string `json:"gas"`
	GasPrice         string `json:"gasPrice"`
	Hash             string `json:"hash"`
	Input            string `json:"input"`
	Nonce            string `json:"nonce"`
	To               string `json:"to"`
	TransactionIndex string `json:"transactionIndex"`
	Value            string `json:"value"`
	Type             string `json:"type"`
	V                string `json:"v"`
	R                string `json:"r"`
	S                string `json:"s"`
}

type WriteInstruction struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

var psCount int
var missingTxs int

func getStateSyncTxns(start, end int, polygonScanApi string) []Tx {
	var txs []Tx
	requestURL := polygonScanApi + "&module=account&action=txlist&address=0x0000000000000000000000000000000000000000" + "&startblock=" + strconv.Itoa(start) + "&endblock=" + strconv.Itoa(end) + "&sort=asc"
	fmt.Println("Fetching data from ", requestURL)

	resp, err := http.Get(requestURL)
	if err != nil {
		fmt.Println("PS: No response from request")
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body) // response body is []byte

	var result PolygonScanResponse
	if err := json.Unmarshal(body, &result); err != nil { // Parse []byte to the go struct pointer
		fmt.Println("PS: Can not unmarshal JSON:")
		fmt.Println(body)
		fmt.Print("\n")
	}

	// fmt.Println(PrettyPrint(result))

	fmt.Println("Got records: ", len(result.Result)/2)
	for i, rec := range result.Result {

		if result.Result[i].From == "0x0000000000000000000000000000000000000000" && result.Result[i].To == "0x0000000000000000000000000000000000000000" {
			txs = append(txs, Tx{BlockNumber: rec.BlockNumber, Hash: rec.Hash, BlockHash: rec.BlockHash})
			psCount += 1
		}
	}
	return txs
}

func PrettyPrint(i interface{}) string {
	s, _ := json.MarshalIndent(i, "", "\t")
	return string(s)
}

func FindAllStateSyncTransactions(startBlock, endBlock, interval uint64, polygonScanApi, remoteRPCUrl, outputFile string) {
	var txs []Tx
	var writeInstructions []WriteInstruction
	var file, err = os.OpenFile(outputFile, os.O_RDWR|os.O_CREATE, 0755)
	if err != nil {
		return
	}

	count := 0
	for startBlock < endBlock {
		nextBlockNo := startBlock + interval // 25000
		txs = getStateSyncTxns(int(startBlock), int(nextBlockNo), polygonScanApi)
		for _, tx := range txs {
			lookupKey := DebugEncodeBorTxLookupEntry(tx.Hash)
			blockNumber, err := strconv.ParseUint(tx.BlockNumber, 10, 64)
			if err != nil {
				log.Fatalf("decimal parse error: %v", err)
			}
			lookupValue := fmt.Sprintf("0x%s", common.Bytes2Hex(big.NewInt(0).SetUint64(blockNumber).Bytes()))

			receiptKey := DebugEncodeBorReceiptKey(blockNumber, tx.BlockHash)
			receiptValue := DebugEncodeBorReceiptValue(tx.Hash, remoteRPCUrl)

			writeInstructions = append(writeInstructions, WriteInstruction{Key: lookupKey, Value: lookupValue})
			writeInstructions = append(writeInstructions, WriteInstruction{Key: receiptKey, Value: receiptValue})
		}
		startBlock = nextBlockNo
		if count%5 == 0 {
			time.Sleep(1 * time.Second)
		}
		count += 1
	}
	fmt.Println("Total no of records from PS: ", psCount)

	fmt.Println()

	b, err := json.MarshalIndent(writeInstructions, "", "    ")
	if err != nil {
		log.Fatalf("json.MarshalIndent failed: %v", err)
	}
	file.WriteString(string(b))
	defer file.Close()

}

func checkTxs(txs []Tx, file *os.File, localRPC string) {

	// curl localhost:8545 -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_getTransactionByHash","params":["0xd96ecec3ac99e7e0f1edc62cff7d349c8c51cbfd0efc72f00662ecee6d41b14a"],"id":0}'

	// url := "http://localhost:80"

	for _, tx := range txs {
		var jsonStr = []byte(`{"jsonrpc":"2.0","method":"eth_getTransactionByHash","params":["` + tx.Hash + `"],"id":0}`)
		req, err := http.NewRequest("POST", localRPC, bytes.NewBuffer(jsonStr))
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			panic(err)
		}
		defer resp.Body.Close()

		// fmt.Println("response Status:", resp.Status)
		// fmt.Println("response Headers:", resp.Header)
		body, _ := io.ReadAll(resp.Body)

		var result TxResponse
		if err := json.Unmarshal(body, &result); err != nil { // Parse []byte to the go struct pointer
			fmt.Println("Bor: Cannot unmarshal JSON")
			fmt.Println(string(body))
		}

		// fmt.Println("response Body:", string(body))

		jsonStr, err = json.Marshal(tx)
		if err != nil {
			fmt.Println("Bor: Error dumping json")
		}

		if result.Result == nil {
			file.WriteString(string(jsonStr) + "\n")
			missingTxs += 1
		}

	}
}
