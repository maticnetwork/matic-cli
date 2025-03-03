// noinspection JSUnresolvedFunction

import { findMaxDevnetId } from '../common/files-utils.js'
import fs from 'fs'

import shell from 'shelljs'
import dotenv from 'dotenv'

export async function terraformInit(cloud) {
  const nextDevnetId = !fs.existsSync('./deployments')
    ? 1
    : findMaxDevnetId() + 1

  shell.exec(`mkdir -p ./deployments/devnet-${nextDevnetId}`)
  shell.exec(`cp ./.env ./deployments/devnet-${nextDevnetId}/.env`)
  shell.exec(
    `cp ./secret.tfvars ./deployments/devnet-${nextDevnetId}/secret.tfvars`
  )
  shell.exec(
    `cp ./terraform/${cloud}/main.tf ./deployments/devnet-${nextDevnetId}/main.tf`
  )
  shell.exec(
    `cp ./terraform/variables/common_vars.tf ./deployments/devnet-${nextDevnetId}/common_vars.tf`
  )
  shell.exec(
    `cp ./terraform/variables/${cloud}_vars.tf ./deployments/devnet-${nextDevnetId}/${cloud}_vars.tf`
  )

  dotenv.config({
    path: `./deployments/devnet-${nextDevnetId}/.env`
  })

  shell.pushd(`./deployments/devnet-${nextDevnetId}`)
  shell.exec(`terraform workspace new devnet-${nextDevnetId}`)
  shell.popd()

  console.log('📍Executing terraform init...')
  shell.exec(`terraform -chdir=./deployments/devnet-${nextDevnetId} init`, {
    env: {
      ...process.env
    }
  })
}
