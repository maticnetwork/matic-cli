// noinspection JSUnresolvedFunction

import execa from 'execa'
import fs from 'fs-extra'
import path from 'path'
import Web3 from 'web3'
import nunjucks from 'nunjucks'
import ethCrypto from 'eth-crypto'
import { bufferToHex, privateToPublic, toBuffer } from 'ethereumjs-util'
import { ethers } from 'ethers'

//
// Add custom nunjucks filters
//

const env = nunjucks.configure()
env.addFilter('publicKey', (privateKey) => {
  return privateKeyToPublicKey(privateKey)
})

//
// other methods
//

const web3 = new Web3()

export async function cloneRepository(name, branch, url, targetDirectory) {
  const repoPath = path.join(targetDirectory, name)

  // create target directory
  await execa('mkdir', ['-p', targetDirectory])

  let cloneResult
  // check if directory exists or not
  if (!fs.existsSync(repoPath)) {
    cloneResult = await execa('git', ['clone', url, name], {
      cwd: targetDirectory
    })
  }

  const fetchResult = await execa('git', ['fetch'], {
    cwd: repoPath
  }).then(() => {
    return execa('git', ['checkout', branch], {
      cwd: repoPath
    })
  })

  if (
    (cloneResult && cloneResult.failed) ||
    (fetchResult && fetchResult.failed)
  ) {
    return Promise.reject(new Error(`Failed to clone or pull ${name}`))
  }
}

export async function processTemplateFiles(dir, obj = {}) {
  // promises
  const p = []

  // process njk files
  fs.readdirSync(dir).forEach((file) => {
    if (file.indexOf('.njk') !== -1) {
      const fp = path.join(dir, file)
      // process all njk files
      fs.writeFileSync(
        path.join(dir, file.replace('.njk', '')),
        env.render(fp, obj)
      )

      // remove njk file
      p.push(
        execa('rm', ['-rf', fp], {
          cwd: dir
        })
      )
    }
  })

  // fulfill all promises
  return Promise.all(p)
}

// returns key store file
export function getKeystoreFile(privateKeyString, password) {
  const ts = new Date()
  const w = web3.eth.accounts.privateKeyToAccount(privateKeyString)
  return {
    keystore: web3.eth.accounts.encrypt(privateKeyString, password),
    keystoreFilename: [
      'UTC--',
      ts.toJSON().replace(/:/g, '-'),
      '--',
      w.address
    ].join('')
  }
}

// creating a wallet using mnemonics from anvil 
export function createAccountsFromMnemonics(mnemonics, totalAccounts) {
  console.log("creating accounts......!!!!!!!!!!!!!!!!!!!!!!!!!")
  console.log(mnemonics);
  const accounts = []
  for(let i = 0; i < totalAccounts; i++) {
    //const account = new ethers.HDNodeWallet(ethers.Mnemonic.fromPhrase(mnemonics) , `m/44'/60'/0'/0/${i}`)
    const mn = ethers.Mnemonic(mnemonics);
    const account = new ethers.HDNodeWallet.fromMnemonic(mn, `m/44'/60'/0'/0/${i}`);

    accounts.push(account)
  }
  return accounts;
}
// return new generated private key
export function getNewPrivateKey() {
  return web3.eth.accounts.create()
}

// return new account from private key
export function getAccountFromPrivateKey(pk) {
  return web3.eth.accounts.privateKeyToAccount(pk)
}

// return public key from private key
export function privateKeyToPublicKey(pk) {
  return bufferToHex(privateToPublic(toBuffer(pk)))
}

// return compressed public key
export function compressedPublicKey(pk) {
  return '0x' + ethCrypto.publicKey.compress(pk.replace('0x', ''))
}

export function errorMissingConfigs(configNames) {
  if (configNames && configNames.length > 0) {
    console.error('Missing the following config attributes: \n')
    configNames.forEach((name) => {
      console.error(name)
    })
    process.exit(1)
  }
}
