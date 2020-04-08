import execa from 'execa';
import fs from 'fs';
import path from 'path';
import Web3 from 'web3';

const web3 = new Web3();

export async function cloneRepository(name, url, options = {}) {
  const repoPath = path.join(options.targetDirectory, name)

  let result = null

  // check if directory exists or not
  if (!fs.existsSync(repoPath)) {
    result = await execa('git', ['clone', url, name], {
      cwd: options.targetDirectory,
    });
  } else {
    result = await execa('git', ['pull'], {
      cwd: repoPath,
    });
  }

  if (result && result.failed) {
    return Promise.reject(new Error(`Failed to clone or pull ${name}`));
  }
  return;
}

// returns key store file
export function getKeystoreFile(privateKeyString, password) {
  const ts = new Date();
  const w = web3.eth.accounts.privateKeyToAccount(privateKeyString)
  return {
    keystore: web3.eth.accounts.encrypt(privateKeyString, password),
    keystoreFilename: ['UTC--', ts.toJSON().replace(/:/g, '-'), '--', w.address].join('')
  }
}

// return new generated private key
export async function getNewPrivateKey() {
  return web3.eth.accounts.create();
}

// return new wallet from private key
export async function getWalletFromPrivateKey(pk) {
  return web3.eth.accounts.privateKeyToAccount(pk)
}