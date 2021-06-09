import execa from 'execa'
import fs from 'fs-extra'
import path from 'path'
import Web3 from 'web3'
import nunjucks from 'nunjucks'
import { toBuffer, privateToPublic, bufferToHex } from 'ethereumjs-util'

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

  let result = null

  // create target directory
  await execa('mkdir', ['-p', targetDirectory])

  // check if directory exists or not
  if (!fs.existsSync(repoPath)) {
    result = await execa('git', ['clone', '-b', branch, url, name], {
      cwd: targetDirectory
    })
  } else {
    result = await execa('git', ['fetch'], {
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

export async function processTemplateFiles(dir, obj = {}) {
  // promises
  const p = []

  // process njk files
  fs.readdirSync(dir).forEach(file => {
    if (file.indexOf('.njk') !== -1) {
      const fp = path.join(dir, file)
      // process all njk files
      fs.writeFileSync(
        path.join(dir, file.replace('.njk', '')),
        env.render(fp, obj)
      )

      // remove njk file
      p.push(execa('rm', ['-rf', fp], {
        cwd: dir
      }))
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
    keystoreFilename: ['UTC--', ts.toJSON().replace(/:/g, '-'), '--', w.address].join('')
  }
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
