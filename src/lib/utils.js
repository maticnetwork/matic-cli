import execa from 'execa'
import fs from 'fs'
import path from 'path'
import Web3 from 'web3'

const web3 = new Web3()

export async function cloneRepository(name, branch, url, targetDirectory) {
  const repoPath = path.join(targetDirectory, name)

  let result = null

  // create target directory
  await execa('mkdir', ['-p', targetDirectory])

  // check if directory exists or not
  if (!fs.existsSync(repoPath)) {
    result = await execa('git', ['clone', '-b', branch, url, name], {
      cwd: targetDirectory
    })
  } else {
    result = await execa('git', ['pull'], {
      cwd: repoPath
    }).then(() => {
      return execa('git', ['checkout', branch], {
        cwd: repoPath
      })
    })
  }

  if (result && result.failed) {
    return Promise.reject(new Error(`Failed to clone or pull ${name}`))
  }
}

// returns key store file
export function getKeystoreFile(privateKeyString, password) {
  const ts = new Date()
  const w = web3.eth.accounts.privateKeyToAccount(privateKeyString)
  return {
    keystore: web3.eth.accounts.encrypt(privateKeyString, password),
    keystoreFilename: ['UTC--', ts.toJSON().replace(/:/g, '-'), '--', w.address].join('')
  }
}

// return new generated private key
export async function getNewPrivateKey() {
  return web3.eth.accounts.create()
}

// return new wallet from private key
export async function getWalletFromPrivateKey(pk) {
  return web3.eth.accounts.privateKeyToAccount(pk)
}
