import inquirer from 'inquirer'
import chalk from 'chalk'

import { getNewPrivateKey } from '../lib/utils'

export async function printDependencyInstructions() {
}

export async function getChainIds(options = {}) {
  const questions = []

  if (!options.borChainId) {
    questions.push({
      type: 'input',
      name: 'borChainId',
      message: 'Please enter Bor chain id',
      default: '15001'
    })
  }

  if (!options.heimdallChainId) {
    questions.push({
      type: 'input',
      name: 'heimdallChainId',
      message: 'Please enter Heimdall chain id',
      default: 'heimdall-15001'
    })
  }

  // return if no questions
  if (questions.length === 0) {
    return {}
  }

  // get answers
  return await inquirer.prompt(questions)
}

export async function getDefaultBranch(options = {}) {

  const questions = []

  if (!options.borBranch) {
    questions.push({
      type: 'input',
      name: 'borBranch',
      message: 'Please enter Bor docker tag',
      default: 'v0.2.16'
    })
  }

  if (!options.heimdallBranch) {
    questions.push({
      type: 'input',
      name: 'heimdallBranch',
      message: 'Please enter Heimdall docker tag',
      default: 'v0.2.9'
    })
  }

  if (!options.contractsBranch) {
    questions.push({
      type: 'input',
      name: 'contractsBranch',
      message: 'Please enter Contracts branch',
      default: 'v0.3.0-backport'
    })
  }

  // return if no questions
  if (questions.length === 0) {
    return {}
  }

  // get answers
  return await inquirer.prompt(questions)
}

export async function getKeystoreDetails(options = {}) {
  const questions = []
  const result = {}

  if (!options.privateKey) {
    let hasPrivateKey = false
    if (options.forceAsk) {
      hasPrivateKey = true
    } else {
      const { hasPrivateKey: hk } = await inquirer.prompt({
        type: 'confirm',
        name: 'hasPrivateKey',
        message: 'Do you have private key? (If not, we will generate it for you)'
      })

      // set answer
      hasPrivateKey = hk
    }

    // enter private key
    if (hasPrivateKey) {
      questions.push({
        type: 'input',
        name: 'privateKey',
        message: 'Please enter private key for keystore',
        validate: (input) => {
          if (!input || input.length !== 66 || !/0x[0-9a-fA-F]{64}/.test(input)) {
            return 'Private key must be valid hex string (with 0x prefix)'
          }

          return true
        }
      })
    } else {
      const w = await getNewPrivateKey()
      result.privateKey = w.privateKey
    }
  } else {
    result.privateKey = options.privateKey
  }

  if (!options.keystorePassword) {
    questions.push({
      type: 'password',
      name: 'keystorePassword',
      message: 'Choose keystore password',
      mask: '*',
      validate: (input) => {
        if (!input || input.length === 0) {
          return 'Please enter non-empty password'
        }

        return true
      }
    })
  }

  // return if no questions
  if (questions.length === 0) {
    return {}
  }

  // return answers
  const { privateKey, keystorePassword } = await inquirer.prompt(questions)
  result.keystorePassword = keystorePassword
  if (!result.privateKey) {
    result.privateKey = privateKey
  }

  return result
}
