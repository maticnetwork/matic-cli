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
	ABI: "[{\"inputs\":[{\"internalType\":\"string\",\"name\":\"key\",\"type\":\"string\"},{\"internalType\":\"uint256\",\"name\":\"value\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"anonymous\":false,\"inputs\":[],\"name\":\"ContractDeployed\",\"type\":\"event\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"key\",\"type\":\"string\"}],\"name\":\"getValue\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"number\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"key\",\"type\":\"string\"},{\"internalType\":\"uint256\",\"name\":\"value\",\"type\":\"uint256\"}],\"name\":\"setValue\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"name\":\"storedValues\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"}]",
	Bin: "0x6080604052602a60005534801561001557600080fd5b506040516107623803806107628339818101604052810190610037919061011e565b610047828261007a60201b60201c565b7fdaf2a119a79dac8445fdc10627116c03f4b0ffb5cf1aee5223ac18a7453e631f60405160405180910390a150506102eb565b8060018360405161008b91906101a3565b9081526020016040518091039020819055505050565b60006100b46100af846101df565b6101ba565b9050828152602081018484840111156100cc57600080fd5b6100d7848285610230565b509392505050565b600082601f8301126100f057600080fd5b81516101008482602086016100a1565b91505092915050565b600081519050610118816102d4565b92915050565b6000806040838503121561013157600080fd5b600083015167ffffffffffffffff81111561014b57600080fd5b610157858286016100df565b925050602061016885828601610109565b9150509250929050565b600061017d82610210565b610187818561021b565b9350610197818560208601610230565b80840191505092915050565b60006101af8284610172565b915081905092915050565b60006101c46101d5565b90506101d08282610263565b919050565b6000604051905090565b600067ffffffffffffffff8211156101fa576101f9610294565b5b610203826102c3565b9050602081019050919050565b600081519050919050565b600081905092915050565b6000819050919050565b60005b8381101561024e578082015181840152602081019050610233565b8381111561025d576000848401525b50505050565b61026c826102c3565b810181811067ffffffffffffffff8211171561028b5761028a610294565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f8301169050919050565b6102dd81610226565b81146102e857600080fd5b50565b610468806102fa6000396000f3fe608060405234801561001057600080fd5b506004361061004c5760003560e01c80637c2da7aa146100515780638381f58a1461006d578063960384a01461008b578063bd796846146100bb575b600080fd5b61006b6004803603810190610066919061022c565b6100eb565b005b610075610112565b60405161008291906102d7565b60405180910390f35b6100a560048036038101906100a091906101eb565b610118565b6040516100b291906102d7565b60405180910390f35b6100d560048036038101906100d091906101eb565b610140565b6040516100e291906102d7565b60405180910390f35b806001836040516100fc91906102c0565b9081526020016040518091039020819055505050565b60005481565b600060018260405161012a91906102c0565b9081526020016040518091039020549050919050565b6001818051602081018201805184825260208301602085012081835280955050505050506000915090505481565b600061018161017c84610317565b6102f2565b90508281526020810184848401111561019957600080fd5b6101a4848285610368565b509392505050565b600082601f8301126101bd57600080fd5b81356101cd84826020860161016e565b91505092915050565b6000813590506101e58161041b565b92915050565b6000602082840312156101fd57600080fd5b600082013567ffffffffffffffff81111561021757600080fd5b610223848285016101ac565b91505092915050565b6000806040838503121561023f57600080fd5b600083013567ffffffffffffffff81111561025957600080fd5b610265858286016101ac565b9250506020610276858286016101d6565b9150509250929050565b600061028b82610348565b6102958185610353565b93506102a5818560208601610377565b80840191505092915050565b6102ba8161035e565b82525050565b60006102cc8284610280565b915081905092915050565b60006020820190506102ec60008301846102b1565b92915050565b60006102fc61030d565b905061030882826103aa565b919050565b6000604051905090565b600067ffffffffffffffff821115610332576103316103db565b5b61033b8261040a565b9050602081019050919050565b600081519050919050565b600081905092915050565b6000819050919050565b82818337600083830152505050565b60005b8381101561039557808201518184015260208101905061037a565b838111156103a4576000848401525b50505050565b6103b38261040a565b810181811067ffffffffffffffff821117156103d2576103d16103db565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f8301169050919050565b6104248161035e565b811461042f57600080fd5b5056fea264697066735822122069f53b67aaa429e62f0de4434b68dc10b9ecde3831ceabfa630ea336363f5e4864736f6c63430008010033",
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

// TestcontractContractDeployedIterator is returned from FilterContractDeployed and is used to iterate over the raw logs and unpacked data for ContractDeployed events raised by the Testcontract contract.
type TestcontractContractDeployedIterator struct {
	Event *TestcontractContractDeployed // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *TestcontractContractDeployedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(TestcontractContractDeployed)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(TestcontractContractDeployed)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *TestcontractContractDeployedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *TestcontractContractDeployedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// TestcontractContractDeployed represents a ContractDeployed event raised by the Testcontract contract.
type TestcontractContractDeployed struct {
	Raw types.Log // Blockchain specific contextual infos
}

// FilterContractDeployed is a free log retrieval operation binding the contract event 0xdaf2a119a79dac8445fdc10627116c03f4b0ffb5cf1aee5223ac18a7453e631f.
//
// Solidity: event ContractDeployed()
func (_Testcontract *TestcontractFilterer) FilterContractDeployed(opts *bind.FilterOpts) (*TestcontractContractDeployedIterator, error) {

	logs, sub, err := _Testcontract.contract.FilterLogs(opts, "ContractDeployed")
	if err != nil {
		return nil, err
	}
	return &TestcontractContractDeployedIterator{contract: _Testcontract.contract, event: "ContractDeployed", logs: logs, sub: sub}, nil
}

// WatchContractDeployed is a free log subscription operation binding the contract event 0xdaf2a119a79dac8445fdc10627116c03f4b0ffb5cf1aee5223ac18a7453e631f.
//
// Solidity: event ContractDeployed()
func (_Testcontract *TestcontractFilterer) WatchContractDeployed(opts *bind.WatchOpts, sink chan<- *TestcontractContractDeployed) (event.Subscription, error) {

	logs, sub, err := _Testcontract.contract.WatchLogs(opts, "ContractDeployed")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(TestcontractContractDeployed)
				if err := _Testcontract.contract.UnpackLog(event, "ContractDeployed", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseContractDeployed is a log parse operation binding the contract event 0xdaf2a119a79dac8445fdc10627116c03f4b0ffb5cf1aee5223ac18a7453e631f.
//
// Solidity: event ContractDeployed()
func (_Testcontract *TestcontractFilterer) ParseContractDeployed(log types.Log) (*TestcontractContractDeployed, error) {
	event := new(TestcontractContractDeployed)
	if err := _Testcontract.contract.UnpackLog(event, "ContractDeployed", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}
