// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package testcontract

import (
	"errors"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = errors.New
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
	_ = abi.ConvertType
)

// TestcontractMetaData contains all meta data concerning the Testcontract contract.
var TestcontractMetaData = &bind.MetaData{
	ABI: "[{\"inputs\":[{\"internalType\":\"string\",\"name\":\"key\",\"type\":\"string\"},{\"internalType\":\"uint256\",\"name\":\"value\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"key\",\"type\":\"string\"}],\"name\":\"getValue\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"number\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"key\",\"type\":\"string\"},{\"internalType\":\"uint256\",\"name\":\"value\",\"type\":\"uint256\"}],\"name\":\"setValue\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"name\":\"storedValues\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"}]",
	Bin: "0x6080604052602a60005534801561001557600080fd5b50604051610736380380610736833981810160405281019061003791906100f2565b610047828261004e60201b60201c565b50506102bf565b8060018360405161005f9190610177565b9081526020016040518091039020819055505050565b6000610088610083846101b3565b61018e565b9050828152602081018484840111156100a057600080fd5b6100ab848285610204565b509392505050565b600082601f8301126100c457600080fd5b81516100d4848260208601610075565b91505092915050565b6000815190506100ec816102a8565b92915050565b6000806040838503121561010557600080fd5b600083015167ffffffffffffffff81111561011f57600080fd5b61012b858286016100b3565b925050602061013c858286016100dd565b9150509250929050565b6000610151826101e4565b61015b81856101ef565b935061016b818560208601610204565b80840191505092915050565b60006101838284610146565b915081905092915050565b60006101986101a9565b90506101a48282610237565b919050565b6000604051905090565b600067ffffffffffffffff8211156101ce576101cd610268565b5b6101d782610297565b9050602081019050919050565b600081519050919050565b600081905092915050565b6000819050919050565b60005b83811015610222578082015181840152602081019050610207565b83811115610231576000848401525b50505050565b61024082610297565b810181811067ffffffffffffffff8211171561025f5761025e610268565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f8301169050919050565b6102b1816101fa565b81146102bc57600080fd5b50565b610468806102ce6000396000f3fe608060405234801561001057600080fd5b506004361061004c5760003560e01c80637c2da7aa146100515780638381f58a1461006d578063960384a01461008b578063bd796846146100bb575b600080fd5b61006b6004803603810190610066919061022c565b6100eb565b005b610075610112565b60405161008291906102d7565b60405180910390f35b6100a560048036038101906100a091906101eb565b610118565b6040516100b291906102d7565b60405180910390f35b6100d560048036038101906100d091906101eb565b610140565b6040516100e291906102d7565b60405180910390f35b806001836040516100fc91906102c0565b9081526020016040518091039020819055505050565b60005481565b600060018260405161012a91906102c0565b9081526020016040518091039020549050919050565b6001818051602081018201805184825260208301602085012081835280955050505050506000915090505481565b600061018161017c84610317565b6102f2565b90508281526020810184848401111561019957600080fd5b6101a4848285610368565b509392505050565b600082601f8301126101bd57600080fd5b81356101cd84826020860161016e565b91505092915050565b6000813590506101e58161041b565b92915050565b6000602082840312156101fd57600080fd5b600082013567ffffffffffffffff81111561021757600080fd5b610223848285016101ac565b91505092915050565b6000806040838503121561023f57600080fd5b600083013567ffffffffffffffff81111561025957600080fd5b610265858286016101ac565b9250506020610276858286016101d6565b9150509250929050565b600061028b82610348565b6102958185610353565b93506102a5818560208601610377565b80840191505092915050565b6102ba8161035e565b82525050565b60006102cc8284610280565b915081905092915050565b60006020820190506102ec60008301846102b1565b92915050565b60006102fc61030d565b905061030882826103aa565b919050565b6000604051905090565b600067ffffffffffffffff821115610332576103316103db565b5b61033b8261040a565b9050602081019050919050565b600081519050919050565b600081905092915050565b6000819050919050565b82818337600083830152505050565b60005b8381101561039557808201518184015260208101905061037a565b838111156103a4576000848401525b50505050565b6103b38261040a565b810181811067ffffffffffffffff821117156103d2576103d16103db565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f8301169050919050565b6104248161035e565b811461042f57600080fd5b5056fea2646970667358221220e37938c3322225435c113cadd65719bbbd65008fd8236a89ce0c885dbb37e12f64736f6c63430008010033",
}

// TestcontractABI is the input ABI used to generate the binding from.
// Deprecated: Use TestcontractMetaData.ABI instead.
var TestcontractABI = TestcontractMetaData.ABI

// TestcontractBin is the compiled bytecode used for deploying new contracts.
// Deprecated: Use TestcontractMetaData.Bin instead.
var TestcontractBin = TestcontractMetaData.Bin

// DeployTestcontract deploys a new Ethereum contract, binding an instance of Testcontract to it.
func DeployTestcontract(auth *bind.TransactOpts, backend bind.ContractBackend, key string, value *big.Int) (common.Address, *types.Transaction, *Testcontract, error) {
	parsed, err := TestcontractMetaData.GetAbi()
	if err != nil {
		return common.Address{}, nil, nil, err
	}
	if parsed == nil {
		return common.Address{}, nil, nil, errors.New("GetABI returned nil")
	}

	address, tx, contract, err := bind.DeployContract(auth, *parsed, common.FromHex(TestcontractBin), backend, key, value)
	if err != nil {
		return common.Address{}, nil, nil, err
	}
	return address, tx, &Testcontract{TestcontractCaller: TestcontractCaller{contract: contract}, TestcontractTransactor: TestcontractTransactor{contract: contract}, TestcontractFilterer: TestcontractFilterer{contract: contract}}, nil
}

// Testcontract is an auto generated Go binding around an Ethereum contract.
type Testcontract struct {
	TestcontractCaller     // Read-only binding to the contract
	TestcontractTransactor // Write-only binding to the contract
	TestcontractFilterer   // Log filterer for contract events
}

// TestcontractCaller is an auto generated read-only Go binding around an Ethereum contract.
type TestcontractCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// TestcontractTransactor is an auto generated write-only Go binding around an Ethereum contract.
type TestcontractTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// TestcontractFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type TestcontractFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// TestcontractSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type TestcontractSession struct {
	Contract     *Testcontract     // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// TestcontractCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type TestcontractCallerSession struct {
	Contract *TestcontractCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts       // Call options to use throughout this session
}

// TestcontractTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type TestcontractTransactorSession struct {
	Contract     *TestcontractTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts       // Transaction auth options to use throughout this session
}

// TestcontractRaw is an auto generated low-level Go binding around an Ethereum contract.
type TestcontractRaw struct {
	Contract *Testcontract // Generic contract binding to access the raw methods on
}

// TestcontractCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type TestcontractCallerRaw struct {
	Contract *TestcontractCaller // Generic read-only contract binding to access the raw methods on
}

// TestcontractTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type TestcontractTransactorRaw struct {
	Contract *TestcontractTransactor // Generic write-only contract binding to access the raw methods on
}

// NewTestcontract creates a new instance of Testcontract, bound to a specific deployed contract.
func NewTestcontract(address common.Address, backend bind.ContractBackend) (*Testcontract, error) {
	contract, err := bindTestcontract(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &Testcontract{TestcontractCaller: TestcontractCaller{contract: contract}, TestcontractTransactor: TestcontractTransactor{contract: contract}, TestcontractFilterer: TestcontractFilterer{contract: contract}}, nil
}

// NewTestcontractCaller creates a new read-only instance of Testcontract, bound to a specific deployed contract.
func NewTestcontractCaller(address common.Address, caller bind.ContractCaller) (*TestcontractCaller, error) {
	contract, err := bindTestcontract(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &TestcontractCaller{contract: contract}, nil
}

// NewTestcontractTransactor creates a new write-only instance of Testcontract, bound to a specific deployed contract.
func NewTestcontractTransactor(address common.Address, transactor bind.ContractTransactor) (*TestcontractTransactor, error) {
	contract, err := bindTestcontract(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &TestcontractTransactor{contract: contract}, nil
}

// NewTestcontractFilterer creates a new log filterer instance of Testcontract, bound to a specific deployed contract.
func NewTestcontractFilterer(address common.Address, filterer bind.ContractFilterer) (*TestcontractFilterer, error) {
	contract, err := bindTestcontract(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &TestcontractFilterer{contract: contract}, nil
}

// bindTestcontract binds a generic wrapper to an already deployed contract.
func bindTestcontract(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := TestcontractMetaData.GetAbi()
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, *parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Testcontract *TestcontractRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Testcontract.Contract.TestcontractCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Testcontract *TestcontractRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Testcontract.Contract.TestcontractTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Testcontract *TestcontractRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Testcontract.Contract.TestcontractTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Testcontract *TestcontractCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Testcontract.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Testcontract *TestcontractTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Testcontract.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Testcontract *TestcontractTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Testcontract.Contract.contract.Transact(opts, method, params...)
}

// GetValue is a free data retrieval call binding the contract method 0x960384a0.
//
// Solidity: function getValue(string key) view returns(uint256)
func (_Testcontract *TestcontractCaller) GetValue(opts *bind.CallOpts, key string) (*big.Int, error) {
	var out []interface{}
	err := _Testcontract.contract.Call(opts, &out, "getValue", key)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// GetValue is a free data retrieval call binding the contract method 0x960384a0.
//
// Solidity: function getValue(string key) view returns(uint256)
func (_Testcontract *TestcontractSession) GetValue(key string) (*big.Int, error) {
	return _Testcontract.Contract.GetValue(&_Testcontract.CallOpts, key)
}

// GetValue is a free data retrieval call binding the contract method 0x960384a0.
//
// Solidity: function getValue(string key) view returns(uint256)
func (_Testcontract *TestcontractCallerSession) GetValue(key string) (*big.Int, error) {
	return _Testcontract.Contract.GetValue(&_Testcontract.CallOpts, key)
}

// Number is a free data retrieval call binding the contract method 0x8381f58a.
//
// Solidity: function number() view returns(uint256)
func (_Testcontract *TestcontractCaller) Number(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _Testcontract.contract.Call(opts, &out, "number")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// Number is a free data retrieval call binding the contract method 0x8381f58a.
//
// Solidity: function number() view returns(uint256)
func (_Testcontract *TestcontractSession) Number() (*big.Int, error) {
	return _Testcontract.Contract.Number(&_Testcontract.CallOpts)
}

// Number is a free data retrieval call binding the contract method 0x8381f58a.
//
// Solidity: function number() view returns(uint256)
func (_Testcontract *TestcontractCallerSession) Number() (*big.Int, error) {
	return _Testcontract.Contract.Number(&_Testcontract.CallOpts)
}

// StoredValues is a free data retrieval call binding the contract method 0xbd796846.
//
// Solidity: function storedValues(string ) view returns(uint256)
func (_Testcontract *TestcontractCaller) StoredValues(opts *bind.CallOpts, arg0 string) (*big.Int, error) {
	var out []interface{}
	err := _Testcontract.contract.Call(opts, &out, "storedValues", arg0)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// StoredValues is a free data retrieval call binding the contract method 0xbd796846.
//
// Solidity: function storedValues(string ) view returns(uint256)
func (_Testcontract *TestcontractSession) StoredValues(arg0 string) (*big.Int, error) {
	return _Testcontract.Contract.StoredValues(&_Testcontract.CallOpts, arg0)
}

// StoredValues is a free data retrieval call binding the contract method 0xbd796846.
//
// Solidity: function storedValues(string ) view returns(uint256)
func (_Testcontract *TestcontractCallerSession) StoredValues(arg0 string) (*big.Int, error) {
	return _Testcontract.Contract.StoredValues(&_Testcontract.CallOpts, arg0)
}

// SetValue is a paid mutator transaction binding the contract method 0x7c2da7aa.
//
// Solidity: function setValue(string key, uint256 value) returns()
func (_Testcontract *TestcontractTransactor) SetValue(opts *bind.TransactOpts, key string, value *big.Int) (*types.Transaction, error) {
	return _Testcontract.contract.Transact(opts, "setValue", key, value)
}

// SetValue is a paid mutator transaction binding the contract method 0x7c2da7aa.
//
// Solidity: function setValue(string key, uint256 value) returns()
func (_Testcontract *TestcontractSession) SetValue(key string, value *big.Int) (*types.Transaction, error) {
	return _Testcontract.Contract.SetValue(&_Testcontract.TransactOpts, key, value)
}

// SetValue is a paid mutator transaction binding the contract method 0x7c2da7aa.
//
// Solidity: function setValue(string key, uint256 value) returns()
func (_Testcontract *TestcontractTransactorSession) SetValue(key string, value *big.Int) (*types.Transaction, error) {
	return _Testcontract.Contract.SetValue(&_Testcontract.TransactOpts, key, value)
}
