package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"math/rand"
	"net/http"
	"time"

	"github.com/ethereum/go-ethereum/common"
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
}

type TestCase struct {
	Key            string
	PrepareRequest func(*ResponseMap) Request
	HandleResponse func(*ResponseMap, Response) error
}

type BatchTestCase []TestCase
type FailedTestCase struct {
	Err error
	Key string
}

func main() {
	// Ethereum node RPC endpoint
	rpcURL := "https://rpc-amoy.polygon.technology"
	mapTestCases := testCasesToMap(testCases)
	responseMap := ResponseMap{}
	mapRequestIdToKey := make(map[int]string)
	failedTestCases := []FailedTestCase{}

	testCaseBatches := []BatchTestCase{
		[]TestCase{
			mapTestCases["eth_chainId"],
			mapTestCases["eth_blockNumber"],
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
		for _, testCase := range testCaseBatch {
			req := testCase.PrepareRequest(&responseMap)
			mapRequestIdToKey[req.ID] = testCase.Key

			requests = append(requests, req)
			countTestCases++
		}

		responses, err := CallEthereumRPC(requests, rpcURL)
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

	for _, failedTestCase := range failedTestCases {
		fmt.Printf("failed test case: %s | err:%s", failedTestCase.Key, failedTestCase.Err)
	}

	fmt.Printf("All Tests Executed | Success: (%d/%d) | Duration: %s\n", countTestCases-len(failedTestCases), countTestCases, time.Since(timeStart))
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
func NewRequest(method string, params interface{}) Request {
	return Request{
		Jsonrpc: "2.0",
		Method:  method,
		Params:  params,
		ID:      rand.Int(),
	}
}

type Validator struct {
	ID               uint64         `json:"ID"`
	Address          common.Address `json:"signer"`
	VotingPower      int64          `json:"power"`
	ProposerPriority int64          `json:"accum"`
}

func parseResponse[T any](raw json.RawMessage) (*T, error) {
	var response T
	if err := json.Unmarshal(raw, &response); err != nil {
		return nil, fmt.Errorf("error unmarshalling JSON: %w", err)
	}

	return &response, nil
}

var testCases = []TestCase{
	{
		Key: "eth_chainId",
		PrepareRequest: func(rm *ResponseMap) Request {
			return NewRequest("eth_chainId", []interface{}{})
		},
		HandleResponse: func(rm *ResponseMap, resp Response) error {
			parsed, err := parseResponse[string](resp.Result)
			if err != nil {
				return err
			}
			hexString := *parsed

			// Remove the "0x" prefix if present
			if len(hexString) >= 2 && hexString[:2] == "0x" {
				hexString = hexString[2:]
			}

			// Convert the hex string to an integer using big.Int
			intValue, success := new(big.Int).SetString(hexString, 16)
			if !success {
				return fmt.Errorf("error converting hex string to integer")
			}
			(*rm).chainId = intValue
			return nil
		},
	},
	{
		Key: "eth_blockNumber",
		PrepareRequest: func(rm *ResponseMap) Request {
			return NewRequest("eth_blockNumber", []interface{}{})
		},
		HandleResponse: func(rm *ResponseMap, resp Response) error {
			parsed, err := parseResponse[string](resp.Result)
			if err != nil {
				return err
			}
			hexString := *parsed

			// Remove the "0x" prefix if present
			if len(hexString) >= 2 && hexString[:2] == "0x" {
				hexString = hexString[2:]
			}

			// Convert the hex string to an integer using big.Int
			intValue, success := new(big.Int).SetString(hexString, 16)
			if !success {
				return fmt.Errorf("error converting hex string to integer")
			}
			(*rm).mostRecentBlock = intValue
			return nil
		},
	},
	{
		Key: "bor_getCurrentProposer",
		PrepareRequest: func(rm *ResponseMap) Request {
			return NewRequest("bor_getCurrentProposer", []interface{}{})
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
		PrepareRequest: func(rm *ResponseMap) Request {
			return NewRequest("bor_getCurrentValidators", []interface{}{})
		},
		HandleResponse: func(rm *ResponseMap, resp Response) error {
			validators, err := parseResponse[[]Validator](resp.Result)
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
		PrepareRequest: func(rm *ResponseMap) Request {
			return NewRequest("eth_getBlockByNumber", []interface{}{fmt.Sprintf("0x%x", (*rm).mostRecentBlock), true})
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
}
