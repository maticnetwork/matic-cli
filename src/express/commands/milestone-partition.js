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
  validateNumberOfPeers,
  validateFinalizedBlock,
  fetchLatestMilestone,
  joinAllPeers
} from '../common/milestone-utils'

const milestoneLength = 64
const queryTimer = (milestoneLength / 4) * 1000

export async function milestonePartition() {
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

  // Wait for a milestone to get proposed for verification
  let lastMilestone = await fetchLatestMilestone(milestoneLength, queryTimer, borHosts[0])
  if (!lastMilestone) {
    console.log('📍Unable to fetch latest milestone from heimdall, exiting')
    return
  }

  console.log('📍Rejoining clusters before performing tests')
 
  // Make sure all peers are joined
  let joined = await joinAllPeers(ips, enodes)
  if (!joined) {
    console.log('📍Unable to join peers before starting tests, exiting')
    return
  }

  console.log('📍Rejoined clusters')

  console.log('📍Waiting 32s to fetch finalized blocks...')
  await timer(32000)

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
  let created = await createClusters(ips, enodes)
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
  let expected = [1, 1, 1, 1]
  if (JSON.stringify(peers) != JSON.stringify(expected)) {
    console.log(`📍Retrying creation of partition clusters for testing due to peer length mismatch, got: ${peers}, expected: ${expected}`)
    created = await createClusters(ips, enodes)
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
  // Cluster 1 has 2 nodes with 1 primary producer whose difficulty will always be higher. 
  // Cluster 2 has other (2) nodes with lower difficulty than cluster 1 and 
  // nodes performing mining out of sync. 

  // Validate if both the clusters are on their own chain. 
  console.log('📍Waiting 10s before fetching latest block from both clusters')
  await timer(10000)

  // We'll fetch block from cluster 2 first as it'll be behind in terms of block height
  let latestBlockCluster1, latestBlockCluster2
  latestBlockCluster2 = await runCommand(getBlock, borHosts[2], 'latest', maxRetries)
  if (latestBlockCluster2 == undefined) {
    console.log('📍Unable to fetch latest block in cluster 2, exiting')
    return
  }

  if (latestBlockCluster2.number) {
    console.log(`📍Trying to fetch block ${Number(latestBlockCluster2.number)} from cluster 1`)
    latestBlockCluster1 = await runCommand(getBlock, borHosts[0], latestBlockCluster2.number, maxRetries)
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

  // Expect no milestone to be proposed
  let latestMilestone = await fetchLatestMilestone(2 * milestoneLength, queryTimer, borHosts[0], lastMilestone)
  if (latestMilestone) {
    console.log('📍New milestone proposed despite non-majority clusters, exiting')
    return
  } 

  // Reconnect both the clusters
  joined = await joinAllPeers(ips, enodes)
  if (!joined) {
    console.log('📍Unable to join peers while rejoining clusters, exiting')
    return
  }

  // Wait for few seconds for reorg to happen
  console.log('📍Waiting 4s for clusters to connect and reorg...')
  await timer(4000)

  // Fetch block from cluster 2 to see if it got reorged to cluster 1
  console.log(`📍Fetching block ${Number(latestBlockCluster1.number)} from cluster 2`)
  latestBlockCluster2 = await runCommand(getBlock, borHosts[2], latestBlockCluster1.number, maxRetries)
  if (latestBlockCluster2 == undefined) {
    console.log(`📍Unable to fetch block ${Number(latestBlockCluster1.number)} in cluster 2, exiting`)
    return
  }
  
  if (latestBlockCluster2.number) {
    if (latestBlockCluster1.hash == latestBlockCluster2.hash) {
      console.log('Cluster 2 successfully reorged to cluster 1 (having high difficulty) as expected')
    } else {
      console.log(`📍Hash mismatch among clusters. Cluster 1 hash: ${latestBlockCluster1.hash}, Cluster 2 hash: ${latestBlockCluster2.hash}, exiting`)
      return
    }
  } else {
    console.log(`📍Unable to fetch ${Number(latestBlockCluster1.number)} in cluster 2, exiting`)
    return
  }

  // For sanity check, also validate the latest block from both clusters
  console.log('📍Fetching latest block from both cluster nodes for sanity check')
  latestBlockCluster1 = await runCommand(getBlock, borHosts[0], 'latest', maxRetries)
  if (latestBlockCluster1 == undefined) {
    console.log('📍Unable to fetch latest block in cluster 1, exiting')
    return
  }

  if (latestBlockCluster1.number) {
    console.log(`📍Trying to fetch block ${Number(latestBlockCluster1.number)} from cluster 2`)
    latestBlockCluster2 = await runCommand(getBlock, borHosts[2], latestBlockCluster1.number, maxRetries)
    if (latestBlockCluster2 == undefined) {
      console.log(`📍Unable to fetch block ${Number(latestBlockCluster1.number)} in cluster 2, exiting`)
      return
    }

    if (latestBlockCluster2.number) {
      // check for block number
      if (latestBlockCluster1.number != latestBlockCluster2.number) {
        console.log(`📍Block number mismatch from clusters. Cluster 1: ${Number(latestBlockCluster1.number)}, Cluster 2: ${Number(latestBlockCluster2.number)}, exiting`)
        return
      }

      // check for block hash
      if (latestBlockCluster1.hash != latestBlockCluster2.hash) {
        console.log(`📍Block hash mismatch, failed reorg. Cluster 1: ${latestBlockCluster1.hash}, Cluster 2: ${latestBlockCluster2.hash}, exiting`)
        return
      }

      console.log(`📍Same block found on both clusters. Block number: ${Number(latestBlockCluster1.number)}, Cluster 1 hash: ${latestBlockCluster1.hash}, Cluster 2 hash: ${latestBlockCluster2.hash}`)
    } else {
      console.log('📍Unable to fetch latest block from 2nd cluster, exiting')
      return
    }
  } else {
    console.log('📍Unable to fetch latest block from 1st cluster, exiting')
    return
  }

  // Wait for the next milestone to get proposed for verification
  latestMilestone = await fetchLatestMilestone(milestoneLength, queryTimer, borHosts[0], lastMilestone)
  if (!latestMilestone) {
    console.log('📍Unable to fetch latest milestone from heimdall, exiting')
    return
  }

  console.log('📍Waiting for bor nodes to import milestone')
  console.log('📍Waiting 32s for bor nodes to import milestone')

  console.log('📍Trying to fetch last finalized block from all nodes and validate')
  let valid = await validateFinalizedBlock(borHosts, latestMilestone)
  if (!valid) {
    console.log('📍Unable to fetch or validate last finalized block from all nodes with last milestone, exiting')
    return
  }

  console.log('📍Finalized block matches with the last milestone')
  console.log('✅ Test Passed')
}
