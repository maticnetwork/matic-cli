import {
  createClusters,
  getIpsAndEnode,
  getUsersAndHosts
} from '../common/milestone-utils'
import { isValidNodeIndex } from '../common/num-utils'

export async function reorg(index) {
  // validate split
  if (!isValidNodeIndex(index)) {
    console.log('❌ Invalid [index] parameter! Exiting ...')
    process.exit(1)
  }
  // Get users and hosts
  const { borUsers, borHosts } = await getUsersAndHosts()

  // Check for number of validators
  if (borUsers.length < 2) {
    console.log('❌ Cannot reorg on a single node devnet! Exiting...')
    process.exit(1)
  }
  // Check for split validity
  if (index >= borUsers.length - 1) {
    console.log(
      `❌ Cannot split on node with index ${index} for a ${borUsers.length}-node network! Exiting...`
    )
    process.exit(1)
  }

  // Get IPs and enodes of all nodes
  const { ips, enodes } = await getIpsAndEnode(borUsers, borHosts)

  console.log('📍Creating reorg...')

  // Next step is to create 2 clusters of the network given the split
  let valid = await createClusters(ips, enodes, index)
  if (!valid) {
    console.log('📍Failed to create partition clusters, retrying')
    valid = await createClusters(ips, enodes, index)
    if (!valid) {
      console.log('📍Failed to create partition clusters, exiting')
      process.exit(1)
    }
  }

  // Reaching this step means that we've created 2 clusters due to the reorg
  console.log('📍Partition clusters created! Reorg active...')
}
