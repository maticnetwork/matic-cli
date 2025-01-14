package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"math/rand"
	"net/http"
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

type ResponseMap map[string]interface{}

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
	responseMap := make(ResponseMap)
	mapRequestIdToKey := make(map[int]string)
	failedTestCases := []FailedTestCase{}

	testCaseBatches := []BatchTestCase{
		[]TestCase{mapTestCases["eth_chainId"]},
	}

	for _, testCaseBatch := range testCaseBatches {
		// Preparing Request
		requests := make([]Request, 0)
		for _, testCase := range testCaseBatch {
			req := testCase.PrepareRequest(&responseMap)
			mapRequestIdToKey[req.ID] = testCase.Key

			requests = append(requests, req)
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

// ConvertHexToInt converts a json.RawMessage containing a hex string to a *big.Int.
func convertHexToInt(raw json.RawMessage) (*big.Int, error) {
	// Decode the JSON to extract the hex string
	var hexString string
	if err := json.Unmarshal(raw, &hexString); err != nil {
		return nil, fmt.Errorf("error unmarshalling JSON: %w", err)
	}

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
		PrepareRequest: func(rm *ResponseMap) Request {
			return NewRequest("eth_chainId", []interface{}{})
		},
		HandleResponse: func(rm *ResponseMap, resp Response) error {
			intValue, err := convertHexToInt(resp.Result)
			if err != nil {
				return err
			}
			(*rm)["chainId"] = intValue
			return nil
		},
	},
}
