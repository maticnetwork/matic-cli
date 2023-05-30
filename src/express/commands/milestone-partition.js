/* eslint-disable dot-notation */
import { timer } from '../common/time-utils'

import {
  createClusters,
  validateFinalizedBlock,
  fetchLatestMilestone,
  joinAllPeers,
  getUsersAndHosts,
  getIpsAndEnode,
  fetchAndValidateSameHeightBlocks,
  fetchAndValidateSameBlocks,
  validateReorg
} from '../common/milestone-utils'

const milestoneLength = 12
const queryTimer = (milestoneLength / 8) * 1000

export async function milestonePartition() {
  // Get users and hosts
  const { borUsers, borHosts } = await getUsersAndHosts()
  if (!borHosts) {
    console.log(
      '❌ This command is not yet supported for Erigon devnets! Exiting...'
    )
    process.exit(1)
  }
  // Check for number of validators
  if (borUsers.length < 4) {
    console.log('📍Cannot run milestone tests on less than 4 validator nodes')
    process.exit(1)
  }

  // Get IPs and enodes of all nodes
  const { ips, enodes } = await getIpsAndEnode(borUsers, borHosts)

  console.log('📍Rejoining clusters before performing tests')
  let joined = await joinAllPeers(ips, enodes)
  if (!joined) {
    console.log('📍Unable to join peers before starting tests, exiting')
    return
  }

  console.log('📍Rejoined clusters')

  // Wait for a milestone to get proposed for verification
  const lastMilestone = await fetchLatestMilestone(
    milestoneLength,
    queryTimer,
    borHosts[0]
  )
  if (!lastMilestone) {
    console.log('📍Unable to fetch latest milestone from heimdall, exiting')
    return
  }

  console.log('📍Waiting 10s to to fetch and validate finalized blocks...')
  await timer(10000)

  // Validate the 'finalized' block with last milestone
  await validateFinalizedBlock(borHosts, lastMilestone)

  console.log('📍Creating clusters for tests')

  // Next step is to create 2 clusters where primary node is separated from the
  // rest of the network. For a partition based test case, the split will be 50:50
  // i.e. out of 4 nodes equal partition of 2-2 nodes will be created.
  let valid = await createClusters(ips, enodes, 2)
  if (!valid) {
    console.log('📍Failed to create partition clusters, retrying')
    valid = await createClusters(ips, enodes, 2)
    if (!valid) {
      console.log('📍Failed to create partition clusters, exiting')
      process.exit(1)
    }
  }

  console.log('📍Partition clusters for testing created. Proceeding to test')

  // Reaching this step means that we've created 2 clusters for testing.
  // Cluster 1 has 2 nodes with 1 primary producer whose difficulty will always be higher.
  // Cluster 2 has other (2) nodes with lower difficulty than cluster 1 and
  // nodes performing mining out of sync.

  // Validate if both the clusters are on their own chain.
  console.log('📍Waiting 10s before fetching latest block from both clusters')
  await timer(10000)

  // Fetch same height blocks from different clusters and validate partition
  const majorityForkBlock = await fetchAndValidateSameHeightBlocks(
    borHosts[0],
    borHosts[2]
  )

  // Expect no milestone to be proposed
  let latestMilestone = await fetchLatestMilestone(
    milestoneLength,
    queryTimer / 4,
    borHosts[0],
    lastMilestone
  )
  if (latestMilestone) {
    console.log(
      '📍New milestone proposed despite non-majority clusters, exiting'
    )
    return
  }

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

  // Fetch block from cluster 2 to see if it got reorged to cluster 1
  // Validate reorg by checking if cluster 2 got reorged to majority
  // fork i.e. cluster 1
  await validateReorg(borHosts[2], majorityForkBlock)
  console.log(
    '📍Cluster 2 successfully reorged to cluster 1 (having high difficulty) as expected'
  )

  // For sanity check, also validate the latest block from both clusters
  await fetchAndValidateSameBlocks(borHosts[0], borHosts[2])

  // Wait for the next milestone to get proposed for verification
  latestMilestone = await fetchLatestMilestone(
    milestoneLength,
    queryTimer,
    borHosts[0],
    lastMilestone
  )
  if (!latestMilestone) {
    console.log('📍Unable to fetch latest milestone from heimdall, exiting')
    return
  }

  console.log('📍Waiting 10s for bor nodes to import milestone')
  await timer(10000)

  console.log(
    '📍Trying to fetch last finalized block from all nodes and validate'
  )
  valid = await validateFinalizedBlock(borHosts, latestMilestone)
  if (!valid) {
    console.log(
      '📍Unable to fetch or validate last finalized block from all nodes with last milestone, exiting'
    )
    return
  }

  console.log('📍Finalized block matches with the last milestone')
  console.log('✅ Test Passed')
}
