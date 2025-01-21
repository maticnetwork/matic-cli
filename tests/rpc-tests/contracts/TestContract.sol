// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TestContract {
    uint256 public number = 42; // Slot 0

    event ContractDeployed();

    // State variable to store the value
    mapping(string => uint256) public storedValues;


    // Constructor to initialize the value
    constructor(string memory key, uint256 value) {
        setValue(key, value);
        emit ContractDeployed();
    }

    // Public function to query the stored value
    function getValue(string memory key) external view returns (uint256) {
        return storedValues[key];
    }

    // Public function to query the stored value
    function setValue(string memory key, uint256 value) public {
        storedValues[key] = value;
    }

}


// to generate bindings:
// cd ./tests/rpc-tests/contracts
// solc --abi --bin TestContract.sol -o . --overwrite
// abigen --abi TestContract.abi --bin TestContract.bin --pkg testcontract --out TestContract.go