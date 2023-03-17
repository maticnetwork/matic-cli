/* eslint-disable dot-notation */
import { loadDevnetConfig, splitToArray } from '../common/config-utils'
import { timer } from '../common/time-utils'

const {
  maxRetries,
  runCommand,
} = require('../common/remote-worker')

import {
  getBlock,
  getPeerLength,
  createClusters,
  getEnode,
  fetchLatestMilestone,
  joinAllPeers,
  validateProposer,
  validateFinalizedBlock,
  checkForRewind,
} from '../common/milestone-utils'

const milestoneLength = 64
const queryTimer = (milestoneLength / 4) * 1000

export async function milestoneBase() {
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
  let ips = []
  for (let i = 0; i < borUsers.length; i++) {
    const ip = `${borUsers[i]}@${borHosts[i]}`
    ips.push(ip)
    tasks.push(getEnode(borUsers[i], borHosts[i]))
  }

  await Promise.all(tasks).then((values) => {
    enodes = values
  })

  if (enodes.includes('')) {
    console.log('📍Unable to fetch enode, exiting')
    return
  }

  console.log('📍Rejoining clusters before performing tests')
  let joined = await joinAllPeers(ips, enodes)
  if (!joined) {
    console.log('📍Unable to join peers before starting tests, exiting')
    return
  }

  console.log('📍Rejoined clusters')

  // Wait for a milestone to get proposed for verification
  let lastMilestone = await fetchLatestMilestone(milestoneLength, queryTimer, borHosts[0])
  if (!lastMilestone) {
    console.log('📍Unable to fetch latest milestone from heimdall, exiting')
    return
  }

  console.log('📍Waiting 10s to fetch finalized blocks...')
  await timer(10000)

  // Fetch the last 'finalized' block
  console.log('📍Trying to fetch last finalized block')
  let finalizedBlock = await runCommand(getBlock, borHosts[0], 'finalized', maxRetries)
  if (finalizedBlock == undefined) {
    console.log('📍Unable to fetch last finalized block, exiting')
    return
  }

  // Check if the number and hash matches with the last milestone
  if (Number(finalizedBlock.number) == Number(lastMilestone.end_block) && finalizedBlock.hash == lastMilestone.hash) {
    console.log('📍Received correct finalized block according to last milestone')
  } else {
    console.log(`📍Block number or hash mismatch for finalized block. Finalized Block Number: ${Number(finalizedBlock.number)}, Hash: ${finalizedBlock.hash}. Milestone end block: ${Number(lastMilestone.end_block)}, Hash: ${lastMilestone.hash} exiting`)
    return
  }

  console.log('📍Creating clusters for tests')

  // Next step is to create 2 clusters where primary node is separated from the
  // rest of the network.
  let created = await createClusters(ips, enodes, 1)
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

  // validate if number of peers are correct or not
  let expected = [0, 2, 2, 2]
  if (JSON.stringify(peers) != JSON.stringify(expected)) {
    console.log(`📍Retrying creation of partition clusters for testing due to peer length mismatch, got: ${peers}, expected: ${expected}`)
    created = await createClusters(ips, enodes, 1)
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

    if (JSON.stringify(peers) != JSON.stringify(expected)) {
      console.log(`📍Peer length mismatch while creating clusters, got: ${peers}, expected: ${expected}`)
      console.log('📍Failed to create partition clusters for testing, exiting')
      return
    } else {
      console.log('📍Partition clusters for testing created. Proceeding to test')
    }
  } else {
    console.log('📍Partition clusters for testing created. Proceeding to test')
  }

  // Reaching this step means that we've created 2 clusters for testing. 
  // Cluster 1 has a single primary producer whose difficulty should always be higher. 
  // Cluster 2 should have remaining nodes (with 2/3+1 stake) all with difficulty lower than node 1
  // and nodes performing mining out of sync. 

  // Validate if both the clusters are on their own chain. 
  console.log('📍Waiting 10s before fetching latest block from both clusters')
  await timer(10000)

  // We'll fetch block from cluster 2 first as it'll be behind in terms of block height
  let latestBlockCluster2 = await runCommand(getBlock, borHosts[1], 'latest', maxRetries)
  if (latestBlockCluster2 == undefined) {
    console.log('📍Unable to fetch latest block in cluster 2, exiting')
    return
  }

  if (latestBlockCluster2.number) {
    console.log(`📍Trying to fetch block ${Number(latestBlockCluster2.number)} from cluster 1`)
    let latestBlockCluster1 = await runCommand(getBlock, borHosts[0], latestBlockCluster2.number, maxRetries)
    if (latestBlockCluster1 == undefined) {
      console.log(`📍Unable to fetch block ${Number(latestBlockCluster2.number)} in cluster 1, exiting`)
      return
    }

    if (latestBlockCluster1.number) {
      if (latestBlockCluster1.number != latestBlockCluster2.number) {
        console.log(`📍Block number mismatch from clusters. Cluster 1: ${Number(latestBlockCluster1.number)}, Cluster 2: ${Number(latestBlockCluster2.number)}, exiting`)
        return
      }

      // Check if same block numbers have different hash or not
      if (latestBlockCluster1.hash == latestBlockCluster2.hash) {
        console.log(`📍Block hash matched. Clusters are not created properly. Cluster 1: ${latestBlockCluster1.hash}, Cluster 2: ${latestBlockCluster2.hash}, exiting`)
        return
      }

      console.log(`📍Same block found with different hash. Block number: ${Number(latestBlockCluster1.number)}, Cluster 1 hash: ${latestBlockCluster1.hash}, Cluster 2 hash: ${latestBlockCluster2.hash}`)
    } else {
      console.log('📍Unable to fetch latest block from 1st cluster, exiting')
      return
    }
  } else {
    console.log('📍Unable to fetch latest block from 2nd cluster, exiting')
    return
  }
  
  // Wait for the next milestone to get proposed and validate
  let latestMilestone = await fetchLatestMilestone(milestoneLength, queryTimer, borHosts[0], lastMilestone)
  if (!latestMilestone) {
    console.log('📍Unable to fetch latest milestone from heimdall, exiting')
    return
  }

  // Validate if the milestone is proposed by validators of cluster 2 and not by validators of cluster 1
  console.log(`📍Validating if milestone got proposed by expected cluster's proposer`)
  await validateProposer(ips[0], latestMilestone.proposer)

  console.log('📍Waiting 10s for bor nodes to import milestone')
  await timer(10000)

  
  // Reconnect both the clusters
  console.log('📍Rejoining clusters')
  joined = await joinAllPeers(ips, enodes)
  if (!joined) {
    console.log('📍Unable to join peers while rejoining clusters, exiting')
    return
  }

  // Wait for few seconds for reorg to happen
  console.log('📍Waiting 4s for clusters to connect and reorg...')
  await timer(4000)
  
  console.log('📍Checking for rewind')
  await checkForRewind(ips[0])

  // Fetch block from cluster 1 to see if it got reorged to cluster 2
  console.log(`📍Fetching block ${Number(latestBlockCluster2.number)} from cluster 1`)
  let latestBlockCluster1 = await runCommand(getBlock, borHosts[0], latestBlockCluster2.number, maxRetries)
  if (latestBlockCluster1 == undefined) {
    console.log(`📍Unable to fetch block ${Number(latestBlockCluster2.number)} in cluster 1, exiting`)
    return
  }
  
  if (latestBlockCluster1.number) {
    if (latestBlockCluster1.hash == latestBlockCluster2.hash) {
      console.log('📍Cluster 1 successfully reorged to cluster 2 (with high majority)')
    } else {
      console.log(`📍Hash mismatch among clusters. Cluster 1 hash: ${latestBlockCluster1.hash}, Cluster 2 hash: ${latestBlockCluster2.hash}, exiting`)
      return
    }
  } else {
    console.log('📍Unable to fetch latest block from 1st cluster, exiting')
    return
  }

  console.log('📍Trying to fetch last finalized block from all nodes and validate')
  let valid = await validateFinalizedBlock(borHosts, latestMilestone)
  if (!valid) {
    console.log('📍Unable to fetch or validate last finalized block from all nodes with last milestone, exiting')
    return
  }

  console.log('📍Finalized block matches with the last milestone')
  console.log('✅ Test Passed')
}
