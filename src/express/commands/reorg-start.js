import {
  createClusters,
  getIpsAndEnode,
  getUsersAndHosts
} from '../common/milestone-utils'
import { isValidPositiveNum } from '../common/num-utils'

export async function startReorg(split) {
  // Get users and hosts
  const { borUsers, borHosts } = await getUsersAndHosts()
  // Check for number of validators
  if (borUsers.length < 2) {
    console.log('❌ Cannot reorg on a single node devnet! Exiting...')
    process.exit(1)
  }
  // Validate split param
  if (!isValidPositiveNum(split) || split >= borUsers.length - 1) {
    console.log('❌ Invalid [split] parameter! Exiting ...')
    process.exit(1)
  }

  // Get IPs and enodes of all nodes
  const { ips, enodes } = await getIpsAndEnode(borUsers, borHosts)

  console.log('📍Creating reorg...')

  // Next step is to create 2 clusters of the network given the split
  let valid = await createClusters(ips, enodes, split)
  if (!valid) {
    console.log('📍Failed to create partition clusters, retrying')
    valid = await createClusters(ips, enodes, split)
    if (!valid) {
      console.log('📍Failed to create partition clusters, exiting')
      process.exit(1)
    }
  }

  // Reaching this step means that we've created 2 clusters due to the reorg
  console.log('📍Partition clusters created! Reorg active...')
}
