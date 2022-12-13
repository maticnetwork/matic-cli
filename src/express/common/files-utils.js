import fs from 'fs'

export function findMaxDevnetId () {
  const deployments = './deployments'
  let max = 0

  fs.readdirSync(deployments).forEach((file) => {
    const match = file.match(/^devnet-(\d)/)
    if (!match) {
      return
    }

    const num = Number(match[1])
    if (num > max) {
      max = num
    }
  })

  return max
}

export function checkDir (isInvokedFromRoot) {
  const path = process.cwd()
  const dirArr = path.split('/')
  const dir = dirArr[dirArr.length - 1]

  if (isInvokedFromRoot) {
    return dir === 'matic-cli'
  } else {
    return dir.match(/^devnet-(\d)/)
  }
}
