// loadbot script to generate public address
// this is done by sending(celo) transactions from a single address to different addresses

package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"math/big"
	"os"
	"strconv"
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

var RPC_SERVERS []string
var MNEMONIC string
var SK string
var N int
var MAX_ACCOUNTS int
var DATA_PATH string

var CURRENT_ITERATIONS int = 0
var Nonce uint64 = 0

func main() {

	MNEMONIC = os.Getenv("MNEMONIC")
	if len(MNEMONIC) == 0 {
		fmt.Println("Invalid MNEMONIC flag")
		return
	}

	RPC_SERVERS = getRPCs()
	if len(RPC_SERVERS) == 0 {
		fmt.Println("Invalid RPC_SERVER flag")
		return
	}

	SK = getSecretKey()

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
		MAX_ACCOUNTS = i
	}

	fmt.Println("RPC_SERVER: ", RPC_SERVERS)
	fmt.Println("MNEMONIC: ", MNEMONIC)
	fmt.Println("SK: ", SK)
	fmt.Println("N: ", N)
	fmt.Println("MAX_ACCOUNTS: ", MAX_ACCOUNTS)

	main1()
}

type Signer struct {
	Address   string `json:"address"`
	PrivKey   string `json:"priv_key"`
	PublicKey string `json:"pub_key"`
}

func getSecretKey() string {
	filename := "../../devnet/devnet/signer-dump.json"
	jsonFile, err := os.Open(filename)
	if err != nil {
		fmt.Printf("failed to open json file: %s, error: %v", filename, err)
		return ""
	}
	defer jsonFile.Close()

	jsonData, err := ioutil.ReadAll(jsonFile)
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
	DevnetBorHosts []string `yaml:"devnetBorHosts"`
}

func getRPCs() []string {

	var yamldoc YamlFile

	rpcs := []string{}

	yamlFile, err := ioutil.ReadFile("../../configs/devnet/remote-setup-config.yaml")
	if err != nil {
		log.Printf("yamlFile.Get err   #%v ", err)
	}

	err = yaml.Unmarshal(yamlFile, &yamldoc)
	if err != nil {
		log.Fatalf("Unmarshal: %v", err)
	}

	for _, rpc := range yamldoc.DevnetBorHosts {
		rpcs = append(rpcs, "http://"+rpc+":8545")
	}
	fmt.Println(rpcs)
	return rpcs
}

func main1() {

	fmt.Printf("script started \n")

	cls := []*ethclient.Client{}

	ctx := context.Background()

	for _, rpc := range RPC_SERVERS {
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

	generatedAccounts := generateAccountsUsingMnemonic(ctx, cls[0])

	fund := os.Getenv("FUND")
	if fund == "true" {
		fundAccounts(ctx, cls[0], generatedAccounts, chainID, add, ksOpts)
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

func generateAccountsUsingMnemonic(ctx context.Context, client *ethclient.Client) (accounts Accounts) {
	wallet, err := hdwallet.NewFromMnemonic(MNEMONIC)
	if err != nil {
		log.Fatal(err)
	}

	for i := 1; i <= N; i++ {
		var dpath string = "m/44'/60'/0'/0/" + strconv.Itoa(i)
		path := hdwallet.MustParseDerivationPath(dpath)
		account, err := wallet.Derive(path, false)
		if err != nil {
			log.Fatal(err)
		}
		log.Println("Account", i, ":", account.Address)
		privKey, err := wallet.PrivateKey(account)
		if err != nil {
			log.Fatal(err)
		}
		accounts = append(accounts, Account{key: privKey, addr: account.Address})
	}
	return accounts
}

func fundAccounts(ctx context.Context, client *ethclient.Client, genAccounts Accounts, chainID *big.Int,
	senderAddress common.Address, opts *bind.TransactOpts) {
	for i := 0; i < N; i++ {
		fmt.Println("Reqd nonce: ", Nonce+uint64(i))
		runTransaction(ctx, client, genAccounts[i].addr, chainID, senderAddress, opts, Nonce+uint64(i), 3000000000000000000)
	}
}

func runTransaction(ctx context.Context, Clients *ethclient.Client, recipient common.Address, chainID *big.Int,
	senderAddress common.Address, opts *bind.TransactOpts, nonce uint64, value int64) {

	fmt.Println("Running transaction : ", nonce)
	var data []byte
	gasLimit := uint64(21000)

	gasPrice := big.NewInt(1000000000)

	val := big.NewInt(value)

	tx := types.NewTransaction(nonce, recipient, val, gasLimit, gasPrice, data)

	signedTx, err := opts.Signer(senderAddress, tx)

	if err != nil {
		log.Fatal("Error in signing tx: ", err)
	}
	err = Clients.SendTransaction(ctx, signedTx)
	if err != nil {
		log.Fatal("Error in sending tx: ", err)
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
		fmt.Printf("i is %v \n", i)
		go func(i int, a Account, m *sync.Mutex) {
			nonce, err := clients[0].PendingNonceAt(ctx, a.addr)
			if err != nil {
				fmt.Printf("failed to retrieve pending nonce for account %s: %v", a.addr.String(), err)
			}
			m.Lock()
			noncesStruct.nonces[i] = nonce
			m.Unlock()
		}(i, a, &noncesStruct.mu)
	}

	fmt.Printf("intialization completed \n")
	recpIdx := 0
	sendIdx := 0

	// Fire off transactions
	period := 1 * time.Second / time.Duration(N)
	ticker := time.NewTicker(period)

	for {
		select {
		case <-ticker.C:

			if CURRENT_ITERATIONS%100 == 0 && CURRENT_ITERATIONS > 0 {
				fmt.Println("CURRENT_ACCOUNTS: ", CURRENT_ITERATIONS)
			}
			if MAX_ACCOUNTS > 0 && CURRENT_ITERATIONS >= MAX_ACCOUNTS {
				os.Exit(0)
			}

			recpIdx++
			sendIdx++
			sender := genAccounts[sendIdx%N] //cfg.Accounts[sendIdx%len(cfg.Accounts)]
			nonce := noncesStruct.nonces[sendIdx%N]

			go func(sender Account, nonce uint64) error {

				recpointer := createAccount()
				recipient := recpointer.addr

				recpointer2 := createAccount()
				recipient2 := recpointer2.addr

				recpointer3 := createAccount()
				recipient3 := recpointer3.addr

				recpointer4 := createAccount()
				recipient4 := recpointer4.addr

				recpointer5 := createAccount()
				recipient5 := recpointer5.addr

				totalClients := uint64(len(clients))
				err := runBotTransaction(ctx, clients[nonce%totalClients], recipient, chainID, sender, nonce, 1)
				if err != nil {
					return err
				}

				err = runBotTransaction(ctx, clients[nonce%totalClients], recipient2, chainID, sender, nonce+1, 1)
				if err != nil {
					return err
				}

				err = runBotTransaction(ctx, clients[nonce%totalClients], recipient3, chainID, sender, nonce+2, 1)
				if err != nil {
					return err
				}

				err = runBotTransaction(ctx, clients[nonce%totalClients], recipient4, chainID, sender, nonce+3, 1)
				if err != nil {
					return err
				}

				err = runBotTransaction(ctx, clients[nonce%totalClients], recipient5, chainID, sender, nonce+4, 1)
				if err != nil {
					return err
				}

				return nil

			}(sender, nonce)
			noncesStruct.nonces[sendIdx%N] = noncesStruct.nonces[sendIdx%N] + 5

		case <-ctx.Done():
			// return group.Wait()
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
	if err != nil {
		fmt.Printf("Error in sending tx: %s, From : %s, To : %s\n", err, sender.addr, recipient.Hash())
	}
	// Nonce++
	CURRENT_ITERATIONS++

	return err
}
