/* eslint-disable dot-notation */
import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import {
  getEnode,
  getBlock,
  addPeers,
  getPeerLength
} from '../common/milestone-utils'
const {
  runCommand,
  runSshCommand,
  runSshCommandWithReturn,
  maxRetries
} = require('../common/remote-worker')
import { checkLatestMilestone } from './monitor'
import { timer } from '../common/time-utils'

export async function getMiner(ip, number) {
  const url = `http://${ip}:8545`
  number = '0x' + Number(number).toString(16) // hexify

  const opts = {
    jsonrpc: '2.0',
    id: 1,
    method: 'bor_getAuthor',
    params: [number]
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts)
  })

  const responseJson = await response.json()
  if (responseJson.result) {
    return responseJson.result
  } else {
    console.log(
      `📍Error fetching miner. number: ${number}, response: ${JSON.stringify(
        response
      )}, opts: ${JSON.stringify(opts)}`
    )
  }

  return undefined
}

export async function getGitBranch(ip, path = '~', repo = 'bor') {
  let command = `cd ${path}/${repo} && git branch --show-current`
  return await runSshCommandWithReturn(ip, command, maxRetries)
}

export async function getLastCommitMessage(ip, repo = 'bor') {
  let command = `cd ~/matic-cli/devnet/code/bor && git show-branch --no-name HEAD`
  return await runSshCommandWithReturn(ip, command, maxRetries)
}

export async function milestoneHelper() {
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)

  const borUsers = splitToArray(doc['devnetBorUsers'].toString())
  const borHosts = splitToArray(doc['devnetBorHosts'].toString())

  let enodes = []
  let tasks = []
  let ips = []
  for (let i = 0; i < borUsers.length; i++) {
    const ip = `${borUsers[i]}@${borHosts[i]}`
    ips.push(ip)
    tasks.push(getEnode(borUsers[i], borHosts[i]))
  }

  await Promise.all(tasks).then((values) => {
    enodes = values
  })

  console.log('ips:', ips)
  console.log('enodes:', enodes)

  tasks = []
  for (let i = 0; i < ips.length; i++) {
    tasks.push(addPeers(ips[i], enodes))
  }

  await Promise.all(tasks).then((values) => {
    console.log('addPeers done. values:', values)
  })

  tasks = []
  for (let i = 0; i < ips.length; i++) {
    tasks.push(getPeerLength(ips[i]))
  }

  await Promise.all(tasks).then((values) => {
    console.log('length:', values)
  })

  // Validate if the milestone is proposed by validators of cluster 2 and not by validators of cluster 1
  // let validators = await getValidatorInfo(ips[0])
  // let latestMilestone = {proposer: "0x0e525b1eb9be52f9dec18a6b233a562a48f6e187"}
  // try {
  //   if (validators) {
  //     if (String(latestMilestone.proposer).toLowerCase() == String(validators[0].address).toLowerCase()) {
  //       console.log(`📍Invalid milestone got proposed from validator/s of cluster 1. Proposer: ${latestMilestone.proposer}, Validators address: ${validators[0].address}, exiting`)
  //       return
  //     }

  //     // Skip the validator from cluster 1
  //     let done = false
  //     for (let i = 1; i < validators.length; i++) {
  //       if (String(latestMilestone.proposer).toLowerCase() == String(validators[i].address).toLowerCase()) {
  //         console.log(`📍Validated milestone proposer`)
  //         done = true
  //         break
  //       }
  //     }

  //     if (!done) {
  //       console.log('📍Invalid milestone got proposed from validator/s of cluster 1, proposer: exiting')
  //       return
  //     }
  //   }
  // } catch (error) {
  //   console.log('📍Error in validating milestone proposer', error)
  // }

  // tasks = []
  // for (let i = 0; i < ips.length; i++) {
  //   tasks.push(getGitBranch(ips[i], i==0 ? '~/matic-cli/devnet/code' : '~'))
  // }

  // await Promise.all(tasks).then((values) => {
  //   console.log("git branches", values)
  // })

  // let arr1 = ["ip1", "ip2", "ip3", "ip4"]
  // let arr2 = ["enode1", "enode2", "enode3", "enode4"]
  // hello(arr1, arr2)

  // tasks = []
  // for (let i = 0; i < ips.length; i++) {
  //   tasks.push(getLastCommitMessage(ips[i]))
  // }

  // await Promise.all(tasks).then((values) => {
  //   console.log("last commit messages", values)
  // })

  // const response1 = await runCommand(getBlock, ips[0], 'latest', 3)
  // console.log('0: ', Number(response1.number), response1.hash)

  // let start = Number(response1.number) - 2000
  // let end = Number(response1.number)

  // for (let i = start; i <= end; i+= 10) {
  //   let miner = await getMiner(ips[0], i)
  //   console.log("block:", i, "miner:", miner)
  // }

  // const response2 = await runCommand(getBlock, ips[1], response1.number, 3)
  // console.log('1: ', Number(response2.number), response2.hash)

  // const response3 = await runCommand(getBlock, ips[2], response1.number, 3)
  // console.log('2: ', Number(response3.number), response3.hash)

  // const response4 = await runCommand(getBlock, ips[3], response1.number, 3)
  // console.log('3: ', Number(response4.number), response4.hash)

  // const milestoneLength = 64
  // const queryTimer = (milestoneLength / 4) * 1000

  // let count = 0
  // let milestone

  // console.log('📍Querying heimdall for next milestone...')
  // while (true) {
  //   if (count > milestoneLength) {
  //     console.log('📍Unable to fetch milestone from heimdall, exiting')
  //     return
  //   }

  //   milestone = await checkLatestMilestone(borHosts[0])
  //   if (milestone.result) {
  //     // Check if the milestone is the immediate next one or not
  //     if (Number(milestone.result.start_block) == Number(lastMilestone.end_block) + 1) {
  //       break
  //     }
  //     console.log('📍Waiting for new milestone...')
  //   } else {
  //     console.log(`📍Invalid milestone received. Response: ${JSON.stringify(milestone.result)}, count: ${count}`)
  //   }

  //   count++
  //   await timer(queryTimer)
  // }

  // let latestMilestone = milestone.result
  // console.log(`📍Got milestone from heimdall. Start block: ${Number(latestMilestone.start_block)}, End block: ${Number(latestMilestone.end_block)}, ID: ${latestMilestone.milestone_id}`)
}

export async function hello(ips, enodes, split = 1) {
  let ips1 = ips.slice(0, split)
  let ips2 = ips.slice(split)
  for (let i = 0; i < ips1.length; i++) {
    console.log(
      'Remove peers 1 - ips[i]:',
      ips1[i],
      ', enodes.slice(split):',
      enodes.slice(split),
      ', i:',
      i
    )
  }
  for (let i = 0; i < ips2.length; i++) {
    console.log(
      'Remove peers 2 - ips[i]:',
      ips2[i],
      ', enodes.slice(0, split):',
      enodes.slice(0, split),
      ', i:',
      i
    )
  }
}
