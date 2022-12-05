import { checkAndReturnVMIndex, loadDevnetConfig } from "../src/express/common/config-utils";
import fs from "fs";
import { maxRetries, runScpCommand } from "../src/express/common/remote-worker";

const Web3 = require("web3")
const bigInt = require("big-integer");
const HDWalletProvider = require("@truffle/hdwallet-provider");
const assert = require('assert');

require('dotenv').config({path: `${process.cwd()}/.env`})

async function fundAccount(web3, sender, accounts, maxFeePerGas, maxPriorityFeePerGas, nonce) {
    const tx = {
        from: sender.address,
        to: accounts[0],
        value: '2000000000000000000',
        nonce: nonce,
        gasLimit: 22000,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas
    };
    await web3.eth.sendTransaction(tx);
}

async function runTest(web3, accounts, sender) {
    try {
        console.log("Executing EIP-1559 test");
        const nonce = await web3.eth.getTransactionCount(sender.address, 'latest');
        console.log("Nonce: ", nonce);

        const burnContract = process.env.BURN_CONTRACT_ADDRESS;

        const latestBlock = await web3.eth.getBlock('latest');
        const miner = latestBlock.miner;
        console.log("Coinbase account: ", miner);

        const maxPriorityFeePerGas = process.env.MAX_PRIORITY_FEE
        const maxFeePerGas = process.env.MAX_FEE

        await fundAccount(web3, sender, accounts, maxFeePerGas, maxPriorityFeePerGas, nonce)

        const initialMinerBal = await web3.eth.getBalance(miner);
        console.log("Initial miner balance: ", initialMinerBal);

        const initialBurnContractBal = await web3.eth.getBalance(burnContract);
        console.log("Initial BurnContract balance: ", initialBurnContractBal);

        const senderNonce = await web3.eth.getTransactionCount(accounts[0], 'latest');
        const tx = {
            from: accounts[0],
            to: accounts[1],
            value: '1',
            nonce: senderNonce,
            gasLimit: 22000,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas
        };
        const res = await web3.eth.sendTransaction(tx);
        console.log("Transaction sent: ", res);
        const gasUsed = res.gasUsed;
        const effectiveGasPrice = res.effectiveGasPrice;
        const block = await web3.eth.getBlock(res.blockNumber);
        const blockBaseFeePerGas = block.baseFeePerGas;

        let priorityFee = effectiveGasPrice - blockBaseFeePerGas;
        console.log("Priority fee paid ", priorityFee);
        let minPriorityFee = Math.min(maxFeePerGas - blockBaseFeePerGas, maxPriorityFeePerGas);
        assert(minPriorityFee === priorityFee, "Expected priority fee not equal to actual priority fee!");

        const burntAmount = gasUsed * blockBaseFeePerGas;
        console.log("Burnt amount queried from transaction: ", burntAmount);
        const finalBurnContractBal = await web3.eth.getBalance(burnContract);
        const actualBurntAmount = (bigInt(finalBurnContractBal).subtract(initialBurnContractBal)).valueOf();
        console.log("Burnt amount queried from burn contract: ", actualBurntAmount);
        assert(actualBurntAmount === burntAmount, "Expected burn amount equal to actual burn amount!");


        const minerReward = gasUsed * (effectiveGasPrice - blockBaseFeePerGas);
        console.log("Miner amount queried from transaction: ", minerReward);
        const finalMinerBal = await web3.eth.getBalance(miner);
        console.log("Final Miner Balance: ", finalMinerBal);
        const actualMinerReward = (bigInt(finalMinerBal).subtract(initialMinerBal)).valueOf();
        console.log("Miner amount queried from miner account: ", actualMinerReward);
        assert(actualMinerReward === minerReward, "Expected miner reward not equal to actual miner reward!");

        const expectedTotalAmount = burntAmount + minerReward;
        console.log("Expected total amount: ", expectedTotalAmount);
        const totalAmount = actualBurntAmount + actualMinerReward;
        console.log("Actual total amount:  ", totalAmount);
        assert(expectedTotalAmount === totalAmount, "Expected burn amount not equal to actual burn amount!");


        console.log("All checks passed!");
        process.exit(0)
    } catch (error) {
        console.log("Error while executing test: ", error);
        console.log("❌ Test Failed!");
        process.exit(1)
    }
}

async function initWeb3(machine) {

    let provider = new HDWalletProvider({
        mnemonic: {
            phrase: process.env.MNEMONIC
        },
        providerOrUrl: `http://${machine}:8545`
    });

    return new Web3(provider);
}

export async function testEip1559(n) {
    try {
        let devnetType = process.env.TF_VAR_DOCKERIZED === "yes" ? "docker" : "remote"
        let doc = await loadDevnetConfig(devnetType)
        let vmIndex = await checkAndReturnVMIndex(n, doc, true)
        let machine
        if (vmIndex === undefined) {
            machine = doc['devnetBorHosts'][0]
            console.log(`📍No index provided. Targeting the first VM by default: ${doc['devnetBorHosts'][0]}...`);
        } else {
            machine = doc['devnetBorHosts'][vmIndex]
        }
        const web3 = await initWeb3(machine)
        const machine0 = doc['devnetBorHosts'][0];
        let src = `${doc['ethHostUser']}@${machine0}:~/matic-cli/devnet/devnet/signer-dump.json`
        let dest = `./signer-dump.json`

        await runScpCommand(src, dest, maxRetries)

        const signer = fs.readFileSync(`./signer-dump.json`);
        const signerAddr = JSON.parse(signer);
        const sender = web3.eth.accounts.privateKeyToAccount(signerAddr[0].priv_key);
        console.log("Signer address: ", sender.address);
        console.log("Signer account balance: ", await web3.eth.getBalance(sender.address));

        await web3.eth.accounts.wallet.add(sender.privateKey)
        let accounts = await web3.eth.getAccounts();
        await runTest(web3, accounts, sender);
    } catch (error) {
        console.log("❌ Error occurred while running eip-1559 tests: ", error);
        process.exit(1)
    }
}