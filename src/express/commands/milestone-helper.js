/* eslint-disable dot-notation */
import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import { getEnode, getBlock, addPeers, getPeerLength } from '../common/milestone-utils'
const { runCommand, runSshCommand, runSshCommandWithReturn } = require('../common/remote-worker')
import { checkLatestMilestone } from './monitor';
import { timer } from '../common/time-utils'

export async function getMiner(ip, number) {
  const url = `http://${ip}:8545`
  number = "0x" + Number(number).toString(16) // hexify

  const opts = {
    "jsonrpc":"2.0",
    "id":1,
    "method":"bor_getAuthor",
    "params":[number],
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(opts)
  })
  
  const responseJson = await response.json()
  if (responseJson.result) {
    return responseJson.result
  } else {
    console.log(`📍Error fetching miner. number: ${number}, response: ${JSON.stringify(response)}, opts: ${JSON.stringify(opts)}`)
  }

  return undefined
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

  console.log(enodes, ips)

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
    console.log("length:", values)
  })

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
