// loadbot script to generate public address
// this is done by sending transactions from a single address to different addresses

package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	hdwallet "github.com/miguelmota/go-ethereum-hdwallet"
	"gopkg.in/yaml.v2"
)

var RpcServers []string
var MNEMONIC string
var SK string
var N int
var MaxAccounts int
var DebugLogs bool

var CurrentIterations = 0
var Nonce uint64 = 0

func main() {

	MNEMONIC = os.Getenv("MNEMONIC")
	if len(MNEMONIC) == 0 {
		fmt.Println("Invalid MNEMONIC flag")
		return
	}

	devnetIdStr := os.Args[1]
	devnetId, err := strconv.Atoi(devnetIdStr)
	if err != nil {
		fmt.Println("Invalid devnet Id: ", err)
		return
	}
	RpcServers = getRPCs(devnetId)
	if len(RpcServers) == 0 {
		fmt.Println("Invalid RPC_SERVER flag")
		return
	}

	SK = getSecretKey(devnetId)

	TPS := os.Getenv("SPEED")
	if len(TPS) == 0 {
		N = 100
	} else {
		i, err := strconv.Atoi(TPS)
		if err != nil {
			fmt.Println("Invalid TPS flag")
			return
		}
		N = i
	}

	acc := os.Getenv("MAX_ACCOUNTS")

	if len(acc) != 0 {
		i, err := strconv.Atoi(acc)
		if err != nil {
			fmt.Println("Invalid MAX_ACCOUNTS flag")
			return
		}
		MaxAccounts = i
	}

	fmt.Println("RPC_SERVER: ", RpcServers)
	fmt.Println("MNEMONIC: ", MNEMONIC)
	fmt.Println("SK: ", SK)
	fmt.Println("N: ", N)
	fmt.Println("MAX_ACCOUNTS: ", MaxAccounts)

	main1()
}

type Signer struct {
	Address   string `json:"address"`
	PrivKey   string `json:"priv_key"`
	PublicKey string `json:"pub_key"`
}

func getSecretKey(devnetId int) string {
	filename := fmt.Sprintf("../../deployments/devnet-%v/signer-dump.json", devnetId)
	jsonFile, err := os.Open(filename)
	if err != nil {
		fmt.Printf("failed to open json file: %s, error: %v", filename, err)
		return ""
	}
	defer func(jsonFile *os.File) {
		_ = jsonFile.Close()
	}(jsonFile)

	jsonData, err := io.ReadAll(jsonFile)
	if err != nil {
		fmt.Printf("failed to read json file, error: %v", err)
		return ""
	}

	var SignerArray []Signer
	if err := json.Unmarshal(jsonData, &SignerArray); err != nil {
		fmt.Printf("failed to unmarshal json file, error: %v", err)
		return ""
	}

	return SignerArray[0].PrivKey
}

type YamlFile struct {
	DevnetBorHosts    []string `yaml:"devnetBorHosts"`
	DevnetErigonHosts []string `yaml:"devnetErigonHosts"`
}

func getRPCs(devnetId int) []string {

	var yamldoc YamlFile

	var rpcs []string

	pathToConfig := fmt.Sprintf("../../deployments/devnet-%v/remote-setup-config.yaml", devnetId)
	yamlFile, err := os.ReadFile(pathToConfig)
	if err != nil {
		log.Printf("yamlFile.Get err   #%v ", err)
	}

	err = yaml.Unmarshal(yamlFile, &yamldoc)
	if err != nil {
		log.Fatalf("Unmarshal: %v", err)
	}
	hosts := append(yamldoc.DevnetBorHosts, yamldoc.DevnetErigonHosts...)
	for i, rpc := range hosts {
		if i < len(yamldoc.DevnetBorHosts) {
			rpcs = append(rpcs, "ws://"+rpc+":8546")
		} else {
			rpcs = append(rpcs, "http://"+rpc+":8545")
		}

	}
	fmt.Println(rpcs)
	return rpcs
}

func main1() {

	fmt.Printf("script started \n")

	var cls []*ethclient.Client

	ctx := context.Background()

	for _, rpc := range RpcServers {
		cl, err := ethclient.Dial(rpc)
		if err != nil {
			log.Println("Error in dial connection: ", err)
		}
		cls = append(cls, cl)
	}

	chainID, err := cls[0].ChainID(ctx)
	if err != nil {
		log.Println("Error in fetching chainID: ", err)
	}
	fmt.Println("Chain ID: ", chainID)

	sk := crypto.ToECDSAUnsafe(common.FromHex(SK))
	ksOpts, err := bind.NewKeyedTransactorWithChainID(sk, chainID)
	if err != nil {
		log.Println("Error in getting ksOpts: ", err)
	}
	add := crypto.PubkeyToAddress(sk.PublicKey)

	balance, err := cls[0].BalanceAt(ctx, add, nil)
	if err != nil {
		log.Println("Error in checking balance: ", err)
	}
	fmt.Println("Balance: ", balance)

	nonce, err := cls[0].PendingNonceAt(ctx, add)
	if err != nil {
		log.Fatalln("Error in getting pendingNonce: ", nonce)
	} else {
		Nonce = nonce
	}
	fmt.Println("Nonce: ", Nonce)

	generatedAccounts := generateAccountsUsingMnemonic()

	fund := os.Getenv("FUND")
	if fund == "true" {
		fundAccounts(ctx, cls[0], generatedAccounts, add, ksOpts)
	}

	debugLogsStr := os.Getenv("STRESS_DEBUG_LOGS")
	DebugLogs, err = strconv.ParseBool(debugLogsStr)
	if err != nil {
		DebugLogs = false
	}

	fmt.Println("Preparing")
	if fund == "true" {
		fmt.Println("Loadbot Starting in 15 secs")
		time.Sleep(15 * time.Second)
	} else {
		time.Sleep(2 * time.Second)
	}

	startLoadbot(ctx, cls, chainID, generatedAccounts)

}

type Account struct {
	key  *ecdsa.PrivateKey
	addr common.Address
}

type Accounts []Account

func generateAccountsUsingMnemonic() (accounts Accounts) {
	wallet, err := hdwallet.NewFromMnemonic(MNEMONIC)
	if err != nil {
		log.Fatal(err)
	}

	for i := 1; i <= N; i++ {
		var derivPath = "m/44'/60'/0'/0/" + strconv.Itoa(i)
		path := hdwallet.MustParseDerivationPath(derivPath)
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

func fundAccounts(ctx context.Context, client *ethclient.Client, genAccounts Accounts, senderAddress common.Address, opts *bind.TransactOpts) {
	for i := 0; i < N; i++ {

		time.Sleep(5 * time.Millisecond)
		go runTransaction(ctx, client, genAccounts[i].addr, senderAddress, opts, Nonce+uint64(3*i), 2200000000000000000)
		go runTransaction(ctx, client, genAccounts[i].addr, senderAddress, opts, Nonce+uint64((3*i)+1), 2200000000000000000)
		go runTransaction(ctx, client, genAccounts[i].addr, senderAddress, opts, Nonce+uint64((3*i)+2), 2200000000000000000)

	}
}

//goland:noinspection GoDeprecation
func runTransaction(ctx context.Context, Client *ethclient.Client, recipient common.Address, senderAddress common.Address, opts *bind.TransactOpts, nonce uint64, value int64) {

	var data []byte
	gasLimit := uint64(21000)

	gasPrice := big.NewInt(4500000000)

	val := big.NewInt(value)

	tx := types.NewTransaction(nonce, recipient, val, gasLimit, gasPrice, data)

	signedTx, err := opts.Signer(senderAddress, tx)

	if err != nil {
		log.Fatal("Error in signing tx: ", err)
	}
	err = Client.SendTransaction(ctx, signedTx)
	if err != nil && DebugLogs {
		fmt.Println("Error in sending tx: ", err, "nonce : ", nonce)
	}
}

func createAccount() Account {
	privateKey, err := crypto.GenerateKey()
	if err != nil {
		log.Fatal(err)
	}

	publicKey := privateKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		log.Fatal("cannot assert type: publicKey is not of type *ecdsa.PublicKey")
	}

	address := crypto.PubkeyToAddress(*publicKeyECDSA)

	account := Account{key: privateKey, addr: address}
	return account

}

type Nonces struct {
	mu     sync.Mutex
	nonces []uint64
}

func startLoadbot(ctx context.Context, clients []*ethclient.Client, chainID *big.Int,
	genAccounts Accounts) {

	fmt.Printf("Loadbot started \n")
	noncesStruct := &Nonces{
		nonces: make([]uint64, N),
	}

	flag := 0
	for i, a := range genAccounts {
		if flag >= N {
			break
		}
		flag++

		go func(i int, a Account, m *sync.Mutex) {
			nonce, err := clients[0].PendingNonceAt(ctx, a.addr)
			if err != nil && DebugLogs {
				fmt.Printf("failed to retrieve pending nonce for account %s: %v", a.addr.String(), err)
			}
			m.Lock()
			noncesStruct.nonces[i] = nonce
			m.Unlock()
		}(i, a, &noncesStruct.mu)
	}

	recpIdx := 0
	sendIdx := 0

	// Fire off transactions
	period := 1 * time.Second / time.Duration(N)
	ticker := time.NewTicker(period)
	defer ticker.Stop()

	resetChan := make(chan bool)

	for {
		select {
		case <-ticker.C:

			if CurrentIterations%100 == 0 && CurrentIterations > 0 {
				fmt.Println("TX_SENT: ", CurrentIterations)
			}
			if MaxAccounts > 0 && CurrentIterations >= MaxAccounts {
				os.Exit(0)
			}

			recpIdx++
			sendIdx++
			sender := genAccounts[sendIdx%N] //cfg.Accounts[sendIdx%len(cfg.Accounts)]
			nonce := noncesStruct.nonces[sendIdx%N]

			go func() {
				_ = func(sender Account, nonce uint64, resetChan chan bool) error {

					recpointer := createAccount()
					recipient := recpointer.addr

					recpointer2 := createAccount()
					recipient2 := recpointer2.addr

					totalClients := uint64(len(clients))
					err := runBotTransaction(ctx, clients[nonce%totalClients], recipient, chainID, sender, nonce, 1)
					if err != nil {
						err1 := strings.Split(err.Error(), " ")
						if err1[0] == "Post" {
							ticker.Stop()
							resetChan <- true
							ctx.Done()
						}
					}

					err = runBotTransaction(ctx, clients[nonce%totalClients], recipient2, chainID, sender, nonce+1, 1)
					if err != nil {
						err1 := strings.Split(err.Error(), " ")
						if err1[0] == "Post" {
							ticker.Stop()
							resetChan <- true
							ctx.Done()
						}
					}
					if err != nil {
						return err
					}
					return nil

				}(sender, nonce, resetChan)
			}()
			noncesStruct.nonces[sendIdx%N] = noncesStruct.nonces[sendIdx%N] + 2

		case <-resetChan:
			fmt.Println("Machine not able to take load... resetting.!")
			_ = os.Setenv("FUND", "false")
			for {
				fmt.Println("RPCs overloaded... waiting for 2 seconds")

				time.Sleep(2 * time.Second)

				if isConnAlive() {
					break
				}
			}
			main1()
			return

		}
	}
}

func genRandomGas(min int64, max int64) *big.Int {
	bg := big.NewInt(max - min)

	n, err := rand.Int(rand.Reader, bg)
	if err != nil {
		panic(err)
	}

	return big.NewInt(n.Int64() + min)
}

func isConnAlive() bool {
	var cls []*ethclient.Client

	ctx := context.Background()

	for _, rpc := range RpcServers {
		cl, err := ethclient.Dial(rpc)
		if err != nil {
			log.Println("Error in dial connection: ", err)
		}
		cls = append(cls, cl)
	}

	_, err := cls[0].ChainID(ctx)
	if err != nil {
		return false
	}

	_, err = cls[0].PendingNonceAt(ctx, common.HexToAddress("0x0"))
	return err == nil
}

//goland:noinspection GoDeprecation
func runBotTransaction(ctx context.Context, Clients *ethclient.Client, recipient common.Address, chainID *big.Int,
	sender Account, nonce uint64, value int64) error {

	var data []byte
	gasLimit := uint64(21000)
	var gasPrice *big.Int

	r := nonce % 6
	switch r {
	case 0:
		gasPrice = genRandomGas(3500000000, 4000000000)
	case 1:
		gasPrice = genRandomGas(2000000000, 2500000000)
	case 2:
		gasPrice = genRandomGas(2500000000, 3000000000)
	case 3:
		gasPrice = genRandomGas(1500000000, 2000000000)
	case 4:
		gasPrice = genRandomGas(1000000000, 1500000000)
	case 5:
		gasPrice = genRandomGas(3000000000, 3500000000)

	}

	val := big.NewInt(value)

	tx := types.NewTransaction(nonce, recipient, val, gasLimit, gasPrice, data)

	sk := crypto.ToECDSAUnsafe(crypto.FromECDSA(sender.key)) // Sign the transaction

	opts, err := bind.NewKeyedTransactorWithChainID(sk, chainID)
	if err != nil {
		log.Fatal("Error in creating signer: ", err)
	}

	signedTx, err := opts.Signer(sender.addr, tx)
	if err != nil {
		log.Fatal("Error in signing tx: ", err)
	}

	err = Clients.SendTransaction(ctx, signedTx)
	if err != nil && DebugLogs {
		fmt.Printf("Error in sending tx: %s, From : %s, To : %s\n", err, sender.addr, recipient.Hash())
	}
	// Nonce++
	CurrentIterations++

	return err
}
