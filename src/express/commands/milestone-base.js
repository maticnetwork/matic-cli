/* eslint-disable dot-notation */
import { timer } from '../common/time-utils'
import {
  createClusters,
  fetchLatestMilestone,
  joinAllPeers,
  validateProposer,
  validateFinalizedBlock,
  checkForRewind,
  getUsersAndHosts,
  getIpsAndEnode,
  fetchSameHeightBlocks,
  validateReorg
} from '../common/milestone-utils'

const milestoneLength = 12
const queryTimer = (milestoneLength / 4) * 1000

export async function milestoneBase() {
  // Get users and hosts
  let borUsers, borHosts = await getUsersAndHosts()

  // Check for number of validators
  if (borUsers.length < 4) {
    console.log('📍Cannot run milestone tests on less than 4 validator nodes')
    process.exit(1)
  }

  // Get IPs and enodes of all nodes
  let ips, enodes = await getIpsAndEnode(borUsers, borHosts)

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

  console.log('📍Waiting 10s to fetch and validate finalized blocks...')
  await timer(10000)

  // Validate the 'finalized' block with last milestone
  await validateFinalizedBlock(borHosts, lastMilestone)

  console.log('📍Creating clusters for tests')

  // Next step is to create 2 clusters where primary node is separated from the
  // rest of the network.
  let valid = await createClusters(ips, enodes, 1)
  if (!valid) {
    console.log(`📍Failed to create partition clusters, retrying`)
    valid = await createClusters(ips, enodes, 1)
    if (!valid) {
      console.log(`📍Failed to create partition clusters, exiting`)
      process.exit(1)
    }
  }

  console.log(
    '📍Partition clusters for testing created. Proceeding to test'
  )

  // Reaching this step means that we've created 2 clusters for testing.
  // Cluster 1 has a single primary producer whose difficulty should always be higher.
  // Cluster 2 should have remaining nodes (with 2/3+1 stake) all with difficulty lower than node 1
  // and nodes performing mining out of sync.

  // Validate if both the clusters are on their own chain.
  console.log('📍Waiting 10s before fetching latest block from both clusters')
  await timer(10000)

  // Fetch same height blocks from different clusters and validate partition
  let majorityForkBlock = await fetchSameHeightBlocks(borHosts[0], borHosts[1])

  // Wait for the next milestone to get proposed and validate
  const latestMilestone = await fetchLatestMilestone(
    milestoneLength,
    queryTimer,
    borHosts[0],
    lastMilestone
  )
  if (!latestMilestone) {
    console.log('📍Unable to fetch latest milestone from heimdall, exiting')
    return
  }

  // Validate if the milestone is proposed by validators of cluster 2 and not by validators of cluster 1
  console.log(
    "📍Validating if milestone got proposed by expected cluster's proposer"
  )
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

  // Validate reorg by checking if cluster 1 got reorged to majority 
  // fork i.e. cluster 2
  await validateReorg(borHosts[0], majorityForkBlock)
  console.log(
    '📍Cluster 1 successfully reorged to cluster 2 (with high majority)'
  )

  console.log(
    '📍Trying to fetch last finalized block from all nodes and validate'
  )
  await validateFinalizedBlock(borHosts, latestMilestone)
  
  console.log('📍Finalized block matches with the last milestone')
  console.log('✅ Test Passed')
}
