/* eslint-disable dot-notation */
import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import { timer } from '../common/time-utils'
import { checkLatestMilestone } from './monitor'

import {
  getBlock,
  getPeerLength,
  createClusters,
  getEnode,
  joinAllPeers,
  validateProposer
} from '../common/milestone-utils'

const { maxRetries, runCommand } = require('../common/remote-worker')

let milestoneLength = 64
const queryTimer = (milestoneLength / 4) * 1000

export async function milestoneBase(testType = 'base') {
  // NOTE: Make sure bor branch has logic for hardcoded primary validator

  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)

  const borUsers = splitToArray(doc['devnetBorUsers'].toString())
  const borHosts = splitToArray(doc['devnetBorHosts'].toString())

  // Check for number of validators
  if (doc['numOfValidators'].length < 4) {
    console.log('📍Cannot run milestone tests on less than 4 validator nodes')
    process.exit(1)
  }

  // Grab the enode of all the nodes
  let enodes = []
  let tasks = []
  const ips = []
  for (let i = 0; i < borUsers.length; i++) {
    const ip = `${borUsers[i]}@${borHosts[i]}`
    ips.push(ip)
    tasks.push(getEnode(borUsers[i], borHosts[i]))
  }

  console.log('ips:', ips)

  await Promise.all(tasks).then((values) => {
    enodes = values
  })

  if (enodes.includes('')) {
    console.log('📍Unable to fetch enode, exiting')
    return
  }

  // Wait for a milestone to get proposed for verification
  let count = 0
  console.log('📍Querying heimdall for next milestone...')
  let milestone
  while (true) {
    if (count > milestoneLength) {
      console.log('📍Unable to fetch milestone from heimdall, exiting')
      return
    }

    milestone = await checkLatestMilestone(borHosts[0])
    if (milestone.result) {
      break
    } else {
      console.log(
        `📍Invalid milestone received. Response: ${JSON.stringify(
          milestone.result
        )}, count: ${count}`
      )
    }

    count++
    await timer(queryTimer)
  }

  const lastMilestone = milestone.result

  console.log(
    `📍Got milestone from heimdall. Start block: ${Number(
      lastMilestone.start_block
    )}, End block: ${Number(lastMilestone.end_block)}, ID: ${
      lastMilestone.milestone_id
    }`
  )
  console.log('📍Rejoining clusters before performing tests')

  // Make sure all peers are joined
  let done = joinAllPeers(ips, enodes)
  if (!done) {
    return
  }

  console.log('📍Waiting to fetch finalized blocks...')
  // await timer(32000)

  // Fetch the last 'finalized' block
  console.log('📍Trying to fetch last finalized block')
  const finalizedBlock = await runCommand(
    getBlock,
    borHosts[0],
    'finalized',
    maxRetries
  )
  if (finalizedBlock === undefined) {
    console.log('📍Unable to fetch last finalized block, exiting')
    return
  }

  // Check if the number and hash matches with the last milestone
  if (
    Number(finalizedBlock.number) === Number(lastMilestone.end_block) &&
    finalizedBlock.hash === lastMilestone.hash
  ) {
    console.log(
      '📍Received correct finalized block according to last milestone'
    )
  } else {
    console.log(
      `📍Block number or hash mismatch for finalized block. Finalized Block Number: ${Number(
        finalizedBlock.number
      )}, Hash: ${finalizedBlock.hash}. Milestone end block: ${Number(
        lastMilestone.end_block
      )}, Hash: ${lastMilestone.hash} exiting`
    )
    return
  }

  console.log(
    '📍Creating clusters for tests. Setting parmeters according to type of test:',
    testType
  )

  // Create 2 clusters based on the kind of tests.
  //      Type of test        Separation Ratio        Primary belonging to
  //      `base`              1:3                     Cluster 1
  //      `partition`         2:2                     Cluster 1

  let split // the split to be used while creating and rejoining clusters
  let index1, index2 // the indexes to be used while accessing nodes from clusters
  let expectedPeers = [] // expected number of peers for each node for validation
  switch (testType) {
    case 'partition':
      split = 2
      index1 = 0
      index2 = 2
      expectedPeers = [1, 1, 1, 1]
      break
    case 'base':
      split = 1
      index1 = 0
      index2 = 1
      expectedPeers = [0, 2, 2, 2]
      break
    default:
      console.log("📍Invalid test type provided, choosing 'base'")
      split = 1
      index1 = 0
      index2 = 1
      expectedPeers = [0, 2, 2, 2]
      break
  }

  let created = await createClusters(ips, enodes, split)
  if (!created) {
    console.log('📍Unable to remove peers for creating clusters, exiting')
    return
  }

  // Validate if the cluster is created by number of peers
  tasks = []
  for (let i = 0; i < ips.length; i++) {
    tasks.push(getPeerLength(ips[i]))
  }

  let peers = []
  await Promise.all(tasks).then((values) => {
    // Check if there's no validation error
    if (values.includes(-1)) {
      console.log('📍Unable to query peer length, exiting')
      return
    }
    peers = values
  })

  if (JSON.stringify(peers) !== JSON.stringify(expectedPeers)) {
    console.log(
      `📍Retrying creation of partition clusters for testing. Got peers: ${peers}, expected: ${expectedPeers}`
    )
    created = await createClusters(ips, enodes, split)
    if (!created) {
      console.log('📍Unable to remove peers for creating clusters, exiting')
      return
    }

    // Validate if the cluster is created by number of peers
    tasks = []
    for (let i = 0; i < ips.length; i++) {
      tasks.push(getPeerLength(ips[i]))
    }

    peers = []
    await Promise.all(tasks).then((values) => {
      // Check if there's no validation error
      if (values.includes(-1)) {
        console.log('📍Unable to query peer length, exiting')
        return
      }
      peers = values
    })

    if (JSON.stringify(peers) !== JSON.stringify(expectedPeers)) {
      console.log('📍Failed to create partition clusters for testing, exiting')
      return
    } else {
      console.log(
        '📍Partition clusters for testing created. Proceeding to test'
      )
    }
  }

  // Reaching this step means that we've created 2 clusters for testing.
  // Cluster 1 has a primary producer whose so it's difficulty will always be higher.
  // Cluster 2 should have remaining nodes (as per the test) with difficulty lower than cluster 1
  //           and nodes performing mining out of sync.

  // Validate if both the clusters are on their own chain.
  console.log('📍Trying to fetch latest block from both clusters after 10s')
  await timer(10000)

  // We'll fetch block from cluster 2 first as it'll be behind in terms of block height
  const latestBlockCluster2 = await runCommand(
    getBlock,
    borHosts[index2],
    'latest',
    maxRetries
  )
  if (latestBlockCluster2 === undefined) {
    console.log('📍Unable to fetch latest block in cluster 2, exiting')
    return
  }

  if (latestBlockCluster2.number) {
    console.log(
      `📍Trying to fetch block ${Number(
        latestBlockCluster2.number
      )} from cluster 1`
    )
    const latestBlockCluster1 = await runCommand(
      getBlock,
      borHosts[index1],
      latestBlockCluster2.number,
      maxRetries
    )
    if (latestBlockCluster1 === undefined) {
      console.log(
        `📍Unable to fetch block ${Number(
          latestBlockCluster2.number
        )} in cluster 1, exiting`
      )
      return
    }

    if (latestBlockCluster1.number) {
      if (latestBlockCluster1.number !== latestBlockCluster2.number) {
        console.log(
          `📍Block number mismatch from clusters. Cluster 1: ${Number(
            latestBlockCluster1.number
          )}, Cluster 2: ${Number(latestBlockCluster2.number)}, exiting`
        )
        return
      }

      // Check if same block numbers have different hash or not
      if (latestBlockCluster1.hash === latestBlockCluster2.hash) {
        console.log(
          `📍Block hash matched. Clusters are not created properly. Cluster 1: ${latestBlockCluster1.hash}, Cluster 2: ${latestBlockCluster2.hash}, exiting`
        )
        return
      }

      console.log(
        `📍Same block found with different hash. Block number: ${Number(
          latestBlockCluster1.number
        )}, Cluster 1 hash: ${latestBlockCluster1.hash}, Cluster 2 hash: ${
          latestBlockCluster2.hash
        }`
      )
    } else {
      console.log('📍Unable to fetch latest block from 1st cluster, exiting')
      return
    }
  } else {
    console.log('📍Unable to fetch latest block from 2nd cluster, exiting')
    return
  }

  // Wait for the next milestone to get proposed for verification
  count = 0
  console.log('📍Querying heimdall for next milestone...')

  // Run the test a bit longer for `partition` type
  if (testType === 'partition') {
    milestoneLength *= 2
  }

  while (true) {
    if (count > milestoneLength) {
      console.log('📍Unable to fetch milestone from heimdall, exiting')
      if (testType !== 'partition') {
        return
      }
    }

    milestone = await checkLatestMilestone(borHosts[0])
    if (milestone.result) {
      // Check if the milestone is the immediate next one or not
      if (
        Number(milestone.result.start_block) ===
        Number(lastMilestone.end_block) + 1
      ) {
        break
      }
      console.log('📍Waiting for new milestone...')
    } else {
      console.log(
        `📍Invalid milestone received. Response: ${JSON.stringify(
          milestone.result
        )}, count: ${count}`
      )
    }

    count++
    await timer(queryTimer)
  }

  const latestMilestone = milestone.result
  console.log(
    `📍Got milestone from heimdall. Start block: ${Number(
      latestMilestone.start_block
    )}, End block: ${Number(latestMilestone.end_block)}, ID: ${
      latestMilestone.milestone_id
    }`
  )

  // Validate if the milestone is proposed by validators of cluster 2 and not by validators of cluster 1
  await validateProposer(ips[index1], latestMilestone.proposer)

  console.log('📍Waiting for bor nodes to import milestone')
  await timer(32000)

  // Reconnect both the clusters
  console.log('📍Rejoining clusters by connecting all peers')
  done = joinAllPeers(ips, enodes)
  if (!done) {
    console.log('📍Unable to rejoin clusters, exiting')
    return
  }

  // Wait for few seconds for reorg to happen
  console.log('📍Waiting for clusters to connect and reorg...')
  await timer(4000)

  // TODO: for partition test, again wait for milestone to go through

  // Fetch block from cluster 1 to see if it got reorged to cluster 2
  console.log(
    `📍Fetching block ${Number(latestBlockCluster2.number)} from cluster 1`
  )
  const latestBlockCluster1 = await runCommand(
    getBlock,
    borHosts[0],
    latestBlockCluster2.number,
    maxRetries
  )
  if (latestBlockCluster1 === undefined) {
    console.log(
      `📍Unable to fetch block ${Number(
        latestBlockCluster2.number
      )} in cluster 1, exiting`
    )
    return
  }

  if (latestBlockCluster1.number) {
    if (latestBlockCluster1.hash === latestBlockCluster2.hash) {
      console.log(
        'Cluster 1 successfully reorged to cluster 2 (with high majority)'
      )
    } else {
      console.log(
        `📍Hash mismatch among clusters. Cluster 1 hash: ${latestBlockCluster1.hash}, Cluster 2 hash: ${latestBlockCluster2.hash}, exiting`
      )
      return
    }
  } else {
    console.log('📍Unable to fetch latest block from 1st cluster, exiting')
    return
  }

  // Fetch the last 'finalized' block from all nodes
  tasks = []
  console.log(
    '📍Trying to fetch last finalized block from all nodes and validate'
  )
  for (let i = 0; i < borHosts.length; i++) {
    tasks.push(runCommand(getBlock, borHosts[i], 'finalized', maxRetries))
  }

  let finalizedBlocks = []
  await Promise.all(tasks).then((values) => {
    // Check if there's empty value
    if (values.includes(undefined)) {
      console.log(
        `📍Error in fetching last finalized block, responses: ${values}, exiting`
      )
      return
    }
    finalizedBlocks = values
  })

  // Check if the number and hash matches with the last milestone
  let exit = false
  for (let i = 0; i < finalizedBlocks.length; i++) {
    if (
      Number(finalizedBlocks[i].number) !== Number(latestMilestone.end_block) ||
      finalizedBlocks[i].hash !== latestMilestone.hash
    ) {
      console.log(
        `📍Block number or hash mismatch for finalized block. Host index: ${i}, Finalized Block Number: ${Number(
          finalizedBlocks[i].number
        )}, Hash: ${finalizedBlocks[i].hash}. Milestone end block: ${Number(
          latestMilestone.end_block
        )}, Hash: ${latestMilestone.hash} exiting`
      )
      exit = true
    }
  }

  if (exit) {
    return
  }

  console.log('📍Finalized block matches with the last milestone')
  console.log('✅ Test Passed')
}
