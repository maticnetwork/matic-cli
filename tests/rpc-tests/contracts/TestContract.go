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
	ABI: "[{\"inputs\":[{\"internalType\":\"string\",\"name\":\"key\",\"type\":\"string\"},{\"internalType\":\"uint256\",\"name\":\"value\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"key\",\"type\":\"string\"}],\"name\":\"getValue\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"key\",\"type\":\"string\"},{\"internalType\":\"uint256\",\"name\":\"value\",\"type\":\"uint256\"}],\"name\":\"setValue\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"name\":\"storedValues\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"}]",
	Bin: "0x608060405234801561001057600080fd5b50604051610701380380610701833981810160405281019061003291906100ed565b610042828261004960201b60201c565b50506102ba565b8060008360405161005a9190610172565b9081526020016040518091039020819055505050565b600061008361007e846101ae565b610189565b90508281526020810184848401111561009b57600080fd5b6100a68482856101ff565b509392505050565b600082601f8301126100bf57600080fd5b81516100cf848260208601610070565b91505092915050565b6000815190506100e7816102a3565b92915050565b6000806040838503121561010057600080fd5b600083015167ffffffffffffffff81111561011a57600080fd5b610126858286016100ae565b9250506020610137858286016100d8565b9150509250929050565b600061014c826101df565b61015681856101ea565b93506101668185602086016101ff565b80840191505092915050565b600061017e8284610141565b915081905092915050565b60006101936101a4565b905061019f8282610232565b919050565b6000604051905090565b600067ffffffffffffffff8211156101c9576101c8610263565b5b6101d282610292565b9050602081019050919050565b600081519050919050565b600081905092915050565b6000819050919050565b60005b8381101561021d578082015181840152602081019050610202565b8381111561022c576000848401525b50505050565b61023b82610292565b810181811067ffffffffffffffff8211171561025a57610259610263565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f8301169050919050565b6102ac816101f5565b81146102b757600080fd5b50565b610438806102c96000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80637c2da7aa14610046578063960384a014610062578063bd79684614610092575b600080fd5b610060600480360381019061005b91906101fc565b6100c2565b005b61007c600480360381019061007791906101bb565b6100e9565b60405161008991906102a7565b60405180910390f35b6100ac60048036038101906100a791906101bb565b610110565b6040516100b991906102a7565b60405180910390f35b806000836040516100d39190610290565b9081526020016040518091039020819055505050565b600080826040516100fa9190610290565b9081526020016040518091039020549050919050565b6000818051602081018201805184825260208301602085012081835280955050505050506000915090505481565b600061015161014c846102e7565b6102c2565b90508281526020810184848401111561016957600080fd5b610174848285610338565b509392505050565b600082601f83011261018d57600080fd5b813561019d84826020860161013e565b91505092915050565b6000813590506101b5816103eb565b92915050565b6000602082840312156101cd57600080fd5b600082013567ffffffffffffffff8111156101e757600080fd5b6101f38482850161017c565b91505092915050565b6000806040838503121561020f57600080fd5b600083013567ffffffffffffffff81111561022957600080fd5b6102358582860161017c565b9250506020610246858286016101a6565b9150509250929050565b600061025b82610318565b6102658185610323565b9350610275818560208601610347565b80840191505092915050565b61028a8161032e565b82525050565b600061029c8284610250565b915081905092915050565b60006020820190506102bc6000830184610281565b92915050565b60006102cc6102dd565b90506102d8828261037a565b919050565b6000604051905090565b600067ffffffffffffffff821115610302576103016103ab565b5b61030b826103da565b9050602081019050919050565b600081519050919050565b600081905092915050565b6000819050919050565b82818337600083830152505050565b60005b8381101561036557808201518184015260208101905061034a565b83811115610374576000848401525b50505050565b610383826103da565b810181811067ffffffffffffffff821117156103a2576103a16103ab565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f8301169050919050565b6103f48161032e565b81146103ff57600080fd5b5056fea26469706673582212208c183e53bd96e3653074030bcbe9409d7b89f955fa340a6bf7eaaeacfb9301e064736f6c63430008010033",
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
