package main

import (
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"log"
	"path/filepath"

	"github.com/cockroachdb/pebble"
	"github.com/ethereum/go-ethereum/common"
)

var (
	borTxLookupPrefix = []byte(borTxLookupPrefixStr)
	borReceiptPrefix  = []byte("matic-bor-receipt-") // borReceiptPrefix + number + block hash -> bor block receipt

)

const (
	borTxLookupPrefixStr = "matic-bor-tx-lookup-"
)

// DebugEncodeBorReceiptKey encodes a bor receipt key for debugging (empty implementation)
func DebugEncodeBorReceiptKey(number uint64, hashString string) {
	hashString = hashString[2:]
	hash := common.HexToHash(hashString)
	enc := make([]byte, 8)
	binary.BigEndian.PutUint64(enc, number)

	bytesKey := append(append(borReceiptPrefix, enc...), hash.Bytes()...)
	fmt.Printf("0x%s\n", common.Bytes2Hex(bytesKey))

}

// DebugEncodeBorTxLookupEntry encodes a bor transaction lookup entry for debugging (empty implementation)
func DebugEncodeBorTxLookupEntry(hashString string) {
	hashString = hashString[2:]

	hash := common.HexToHash(hashString)
	bytesKey := append(borTxLookupPrefix, hash.Bytes()...)
	fmt.Printf("0x%s\n", common.Bytes2Hex(bytesKey))
}

// DebugDeleteKey deletes a key in the data store for debugging (empty implementation)
func DebugDeleteKey(dataPath string, key string) {
	key = key[2:]

	// Path to Pebble database (chaindata) under the data directory
	dbPath := filepath.Join(dataPath, "bor", "chaindata")
	db, err := pebble.Open(dbPath, &pebble.Options{})
	if err != nil {
		log.Fatalf("Failed to open Pebble DB at %s: %v", dbPath, err)
	}
	defer db.Close()

	// Decode hex-encoded key
	keyBytes, err := hex.DecodeString(key)
	if err != nil {
		log.Fatalf("Invalid hex key %s: %v", key, err)
	}

	// Read value
	err = Delete(db, keyBytes)
	if err != nil {
		if err == pebble.ErrNotFound {
			fmt.Printf("Key %s not found in database\n", key)
			return
		}
		log.Fatalf("Error deleting key %s: %v", key, err)
	}
	fmt.Printf("Successfully deleted the key\n")
}

// DebugReadKey reads a key from the offline Pebble database.
func DebugReadKey(dataPath string, key string) {
	key = key[2:]

	// Path to Pebble database (chaindata) under the data directory
	dbPath := filepath.Join(dataPath, "bor", "chaindata")
	db, err := pebble.Open(dbPath, &pebble.Options{})
	if err != nil {
		log.Fatalf("Failed to open Pebble DB at %s: %v", dbPath, err)
	}
	defer db.Close()

	// Decode hex-encoded key
	keyBytes, err := hex.DecodeString(key)
	if err != nil {
		log.Fatalf("Invalid hex key %s: %v", key, err)
	}

	// Read value
	value, err := Get(db, keyBytes)
	if err != nil {
		if err == pebble.ErrNotFound {
			fmt.Printf("Key %s not found in database\n", key)
			return
		}
		log.Fatalf("Error reading key %s: %v", key, err)
	}

	// Print value in hex
	fmt.Printf("%x\n", value)
}

func DebugWriteKey(dataPath string, key string, value string) {
	key = key[2:]
	value = value[2:]

	// Path to Pebble database (chaindata) under the data directory
	dbPath := filepath.Join(dataPath, "bor", "chaindata")
	db, err := pebble.Open(dbPath, &pebble.Options{})
	if err != nil {
		log.Fatalf("Failed to open Pebble DB at %s: %v", dbPath, err)
	}
	defer db.Close()

	// Decode hex-encoded key
	keyBytes, err := hex.DecodeString(key)
	if err != nil {
		log.Fatalf("Invalid hex key %s: %v", key, err)
	}

	// Decode hex-encoded key
	valueBytes, err := hex.DecodeString(value)
	if err != nil {
		log.Fatalf("Invalid hex value %s: %v", key, err)
	}

	// Read value
	err = Put(db, keyBytes, valueBytes)
	if err != nil {
		if err == pebble.ErrNotFound {
			fmt.Printf("Key %s not found in database\n", key)
			return
		}
		log.Fatalf("Error reading key %s: %v", key, err)
	}

	// Print value in hex
	fmt.Printf("Successfully write the key\n", value)
}

func Get(db *pebble.DB, key []byte) ([]byte, error) {
	dat, closer, err := db.Get(key)
	if err != nil {
		return nil, err
	}

	ret := make([]byte, len(dat))
	copy(ret, dat)
	if err = closer.Close(); err != nil {
		return nil, err
	}
	return ret, nil
}

// Put inserts the given value into the key-value store.
func Put(db *pebble.DB, key []byte, value []byte) error {
	return db.Set(key, value, pebble.Sync)
}

// Delete removes the key from the key-value store.
func Delete(db *pebble.DB, key []byte) error {
	return db.Delete(key, pebble.Sync)
}
