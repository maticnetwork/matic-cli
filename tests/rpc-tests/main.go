package main

import (
	"bytes"
	"crypto/ecdsa"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math/big"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/consensus/bor/valset"
	hdwallet "github.com/miguelmota/go-ethereum-hdwallet"
)

// Request represents the JSON-RPC request payload.
type Request struct {
	Jsonrpc string      `json:"jsonrpc"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params"`
	ID      int         `json:"id"`
}

// Response represents the JSON-RPC response payload.
type Response struct {
	Jsonrpc string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *RPCError       `json:"error"`
}

// RPCError represents an error in a JSON-RPC response.
type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type ResponseMap struct {
	chainId                *big.Int
	mostRecentBlock        *big.Int
	currentProposerAddress common.Address
	accounts               Accounts
	gasPrice               *big.Int
}

type TestCase struct {
	Key            string
	PrepareRequest func(*ResponseMap) (*Request, error)
	HandleResponse func(*ResponseMap, Response) error
}

type BatchTestCase []TestCase
type FailedTestCase struct {
	Err error
	Key string
}

var (
	rpcURL   = flag.String("rpc-url", "", "RPC Url to be tested")
	mnemonic = flag.String("mnemonic", "", "mnemonic to be used on transactions")
)

func main() {
	flag.Parse()
	if *mnemonic == "" {
		fmt.Println("Invalid mnemonic flag")
		return
	}
	if *rpcURL == "" {
		fmt.Println("Invalid rpcURL flag")
		return
	}

	// Ethereum node RPC endpoint
	mapTestCases := testCasesToMap(testCases)
	responseMap := ResponseMap{}
	mapRequestIdToKey := make(map[int]string)
	failedTestCases := []FailedTestCase{}
	responseMap.accounts = generateAccountsUsingMnemonic(*mnemonic, 10)
	testCaseBatches := []BatchTestCase{
		[]TestCase{
			mapTestCases["eth_chainId"],
			mapTestCases["eth_blockNumber"],
			mapTestCases["eth_getTransactionCount"],
			mapTestCases["eth_getBalance"],
			mapTestCases["eth_gasPrice"],
			mapTestCases["eth_feeHistory"],
			mapTestCases["bor_getCurrentProposer"],
			mapTestCases["bor_getCurrentValidators"],
		},
		[]TestCase{
			mapTestCases["eth_getBlockByNumber"],
			// mapTestCases["eth_getHeaderByNumber"],
			// mapTestCases["eth_getUncleCountByBlockNumber"],
			// mapTestCases["eth_getBlockTransactionCountByNumber"],
			// mapTestCases["bor_getAuthor"],
			// mapTestCases["bor_getSnapshotProposer"],
			// mapTestCases["bor_getSnapshotProposerSequence"],
		},
	}

	timeStart := time.Now()
	countTestCases := 0
	for _, testCaseBatch := range testCaseBatches {
		// Preparing Request
		requests := make([]Request, 0)
		countTestCases += len(testCaseBatch)
		for _, testCase := range testCaseBatch {
			req, err := testCase.PrepareRequest(&responseMap)
			if err != nil {
				failedTestCases = append(failedTestCases, FailedTestCase{Key: testCase.Key, Err: err})
				continue
			}
			if req == nil {
				continue
			}

			mapRequestIdToKey[req.ID] = testCase.Key

			requests = append(requests, *req)
		}

		responses, err := CallEthereumRPC(requests, *rpcURL)
		if err != nil {
			fmt.Printf("Error while calling Ethereum RPC: %v\n", err)
		}

		// Handling Response
		for _, response := range responses {
			key := mapRequestIdToKey[response.ID]
			err := mapTestCases[key].HandleResponse(&responseMap, response)
			if err != nil {
				failedTestCases = append(failedTestCases, FailedTestCase{Key: key, Err: err})
			}

		}
	}

	fmt.Printf("All Tests Executed | Success: (%d/%d) | Duration: %s\n", countTestCases-len(failedTestCases), countTestCases, time.Since(timeStart))

	if len(failedTestCases) > 0 {
		fmt.Println("Failed Tests Cases:")
	}
	for _, failedTestCase := range failedTestCases {
		fmt.Printf("\tkey: %s | err:%s\n", failedTestCase.Key, failedTestCase.Err)
	}
}

func testCasesToMap(testCases []TestCase) map[string]TestCase {
	mapTestCases := make(map[string]TestCase)
	for _, testCase := range testCases {
		mapTestCases[testCase.Key] = testCase
	}
	return mapTestCases
}

// CallEthereumRPC performs an RPC call to an Ethereum node.
func CallEthereumRPC(reqPayload []Request, rpcURL string) ([]Response, error) {
	// Serialize the request to JSON
	reqBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return nil, fmt.Errorf("error marshalling request: %w", err)
	}

	// Make the HTTP POST request
	resp, err := http.Post(rpcURL, "application/json", bytes.NewBuffer(reqBytes))
	if err != nil {
		return nil, fmt.Errorf("error making RPC call: %w", err)
	}
	defer resp.Body.Close()

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response body: %w", err)
	}

	// Deserialize the response
	var rpcResp []Response
	err = json.Unmarshal(body, &rpcResp)
	if err != nil {
		return nil, fmt.Errorf("error unmarshalling response: %w", err)
	}

	// Return the response
	return rpcResp, nil
}

// NewRequest creates a new Request with Jsonrpc set to "2.0" and other fields given as parameters.
func NewRequest(method string, params interface{}) *Request {
	return &Request{
		Jsonrpc: "2.0",
		Method:  method,
		Params:  params,
		ID:      rand.Int(),
	}
}

func parseResponse[T any](raw json.RawMessage) (*T, error) {
	var response T
	if err := json.Unmarshal(raw, &response); err != nil {
		return nil, fmt.Errorf("error unmarshalling JSON: %w", err)
	}

	return &response, nil
}

type Account struct {
	key   *ecdsa.PrivateKey
	addr  common.Address
	nonce *big.Int
}
type Accounts []Account
type feeHistoryResult struct {
	OldestBlock      *hexutil.Big     `json:"oldestBlock"`
	Reward           [][]*hexutil.Big `json:"reward,omitempty"`
	BaseFee          []*hexutil.Big   `json:"baseFeePerGas,omitempty"`
	GasUsedRatio     []float64        `json:"gasUsedRatio"`
	BlobBaseFee      []*hexutil.Big   `json:"baseFeePerBlobGas,omitempty"`
	BlobGasUsedRatio []float64        `json:"blobGasUsedRatio,omitempty"`
}

func generateAccountsUsingMnemonic(MNEMONIC string, N int) (accounts Accounts) {
	wallet, err := hdwallet.NewFromMnemonic(MNEMONIC)
	if err != nil {
		log.Fatal(err)
	}

	for i := 1; i <= N; i++ {
		var dpath = "m/44'/60'/0'/0/" + strconv.Itoa(i)
		path := hdwallet.MustParseDerivationPath(dpath)
		account, err := wallet.Derive(path, false)
		if err != nil {
			log.Fatal(err)
		}

		privKey, err := wallet.PrivateKey(account)
		if err != nil {
			log.Fatal(err)
		}
		accounts = append(accounts, Account{key: privKey, addr: account.Address})
	}
	return accounts
}

func hexStringToBigInt(hexString string) (*big.Int, error) {
	// Remove the "0x" prefix if present
	if len(hexString) >= 2 && hexString[:2] == "0x" {
		hexString = hexString[2:]
	}

	// Convert the hex string to an integer using big.Int
	intValue, success := new(big.Int).SetString(hexString, 16)
	if !success {
		return nil, fmt.Errorf("error converting hex string to integer")
	}
	return intValue, nil
}

var testCases = []TestCase{
	{
		Key: "eth_chainId",
		PrepareRequest: func(rm *ResponseMap) (*Request, error) {
			return NewRequest("eth_chainId", []interface{}{}), nil
		},
		HandleResponse: func(rm *ResponseMap, resp Response) error {
			parsed, err := parseResponse[string](resp.Result)
			if err != nil {
				return err
			}
			intValue, err := hexStringToBigInt(*parsed)
			if err != nil {
				return err
			}

			(*rm).chainId = intValue
			return nil
		},
	},
	{
		Key: "eth_blockNumber",
		PrepareRequest: func(rm *ResponseMap) (*Request, error) {
			return NewRequest("eth_blockNumber", []interface{}{}), nil
		},
		HandleResponse: func(rm *ResponseMap, resp Response) error {
			parsed, err := parseResponse[string](resp.Result)
			if err != nil {
				return err
			}
			intValue, err := hexStringToBigInt(*parsed)
			if err != nil {
				return err
			}
			(*rm).mostRecentBlock = intValue
			return nil
		},
	},
	{
		Key: "eth_getTransactionCount",
		PrepareRequest: func(rm *ResponseMap) (*Request, error) {
			return NewRequest("eth_getTransactionCount", []interface{}{(*rm).accounts[0].addr, "latest"}), nil
		},
		HandleResponse: func(rm *ResponseMap, resp Response) error {
			parsed, err := parseResponse[string](resp.Result)
			if err != nil {
				return err
			}
			intValue, err := hexStringToBigInt(*parsed)
			if err != nil {
				return err
			}

			// set nonce for accounts[0]
			(*rm).accounts[0].nonce = intValue
			return nil
		},
	},
	{
		Key: "bor_getCurrentProposer",
		PrepareRequest: func(rm *ResponseMap) (*Request, error) {
			return NewRequest("bor_getCurrentProposer", []interface{}{}), nil
		},
		HandleResponse: func(rm *ResponseMap, resp Response) error {
			currentProposerAddress, err := parseResponse[common.Address](resp.Result)
			if err != nil {
				return err
			}
			if (*currentProposerAddress == common.Address{}) {
				return fmt.Errorf("invalid proposer address: %s", currentProposerAddress)
			}
			(*rm).currentProposerAddress = *currentProposerAddress
			return nil
		},
	},
	{
		Key: "bor_getCurrentValidators",
		PrepareRequest: func(rm *ResponseMap) (*Request, error) {
			return NewRequest("bor_getCurrentValidators", []interface{}{}), nil
		},
		HandleResponse: func(rm *ResponseMap, resp Response) error {
			validators, err := parseResponse[[]valset.Validator](resp.Result)
			if err != nil {
				return err
			}
			if len(*validators) == 0 {
				return fmt.Errorf("must be at least one validator")
			}
			// todo: more validators verification
			return nil
		},
	},
	{
		Key: "eth_getBlockByNumber",
		PrepareRequest: func(rm *ResponseMap) (*Request, error) {
			return NewRequest("eth_getBlockByNumber", []interface{}{fmt.Sprintf("0x%x", (*rm).mostRecentBlock), true}), nil
		},
		HandleResponse: func(rm *ResponseMap, resp Response) error {
			block, err := parseResponse[map[string]interface{}](resp.Result)
			if err != nil {
				return err
			}
			if block == nil {
				return fmt.Errorf("block not found")
			}
			return nil
		},
	},
	{
		Key: "eth_getBalance",
		PrepareRequest: func(rm *ResponseMap) (*Request, error) {
			return NewRequest("eth_getBalance", []interface{}{(*rm).accounts[0].addr, "latest"}), nil
		},
		HandleResponse: func(rm *ResponseMap, resp Response) error {
			parsed, err := parseResponse[string](resp.Result)
			if err != nil {
				return err
			}
			balance, err := hexStringToBigInt(*parsed)
			if err != nil {
				return err
			}

			if (*balance).Cmp(big.NewInt(0)) <= 0 {
				return fmt.Errorf("balance must be greater than 0")
			}
			return nil
		},
	},
	{
		Key: "eth_gasPrice",
		PrepareRequest: func(rm *ResponseMap) (*Request, error) {
			return NewRequest("eth_gasPrice", []interface{}{}), nil
		},
		HandleResponse: func(rm *ResponseMap, resp Response) error {
			parsed, err := parseResponse[string](resp.Result)
			if err != nil {
				return err
			}
			gasPrice, err := hexStringToBigInt(*parsed)
			if err != nil {
				return err
			}

			if (*gasPrice).Cmp(big.NewInt(0)) <= 0 {
				return fmt.Errorf("gas price must be greater than 0")
			}
			(*rm).gasPrice = gasPrice
			return nil
		},
	},
	{
		Key: "eth_feeHistory",
		PrepareRequest: func(rm *ResponseMap) (*Request, error) {
			return NewRequest("eth_feeHistory", []interface{}{4, "latest", []int{25, 75}}), nil
		},
		HandleResponse: func(rm *ResponseMap, resp Response) error {
			feeHistory, err := parseResponse[feeHistoryResult](resp.Result)
			if err != nil {
				return err
			}
			if (*big.Int)(feeHistory.OldestBlock).Cmp(big.NewInt(0)) <= 0 {
				return fmt.Errorf("invalid oldest block: %s", (*big.Int)(feeHistory.OldestBlock).String())
			}

			// Check if Reward, BaseFee, and GasUsedRatio slices have consistent lengths
			expectedLength := len(feeHistory.Reward)
			if len(feeHistory.BaseFee) != expectedLength+1 {
				return fmt.Errorf("BaseFee length must be Reward length + 1: got %d, expected %d", len(feeHistory.BaseFee), expectedLength+1)
			}
			if len(feeHistory.GasUsedRatio) != expectedLength {
				return fmt.Errorf("GasUsedRatio length must match Reward length: got %d, expected %d", len(feeHistory.GasUsedRatio), expectedLength)
			}

			// Validate each BaseFee value is positive
			for i, fee := range feeHistory.BaseFee {
				if (*big.Int)(fee).Cmp(big.NewInt(0)) <= 0 {
					return fmt.Errorf("invalid BaseFeePerGas at index %d: %s", i, (*big.Int)(fee).String())
				}
			}

			// Validate GasUsedRatio values are within [0, 1]
			for i, ratio := range feeHistory.GasUsedRatio {
				if ratio < 0 || ratio > 1 {
					return fmt.Errorf("invalid GasUsedRatio at index %d: %f", i, ratio)
				}
			}

			// Validate Reward values are non-empty and positive
			for i, rewards := range feeHistory.Reward {
				if len(rewards) == 0 {
					return fmt.Errorf("empty Reward slice at index %d", i)
				}
				for j, reward := range rewards {
					if (*big.Int)(reward).Cmp(big.NewInt(0)) < 0 {
						return fmt.Errorf("negative Reward value at Reward[%d][%d]: %s", i, j, (*big.Int)(reward).String())
					}
				}
			}
			return nil
		},
	},
}
