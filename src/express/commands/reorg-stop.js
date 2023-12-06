import {
  getIpsAndEnode,
  getUsersAndHosts,
  joinAllPeers
} from '../common/milestone-utils.js'

export async function stopReorg() {
  // Get users and hosts
  const { borUsers, borHosts } = await getUsersAndHosts()
  if (!borHosts) {
    console.log(
      '❌ This command is not yet supported for Erigon devnets! Exiting...'
    )
    process.exit(1)
  }
  // Get IPs and enodes of all nodes
  const { ips, enodes } = await getIpsAndEnode(borUsers, borHosts)

  console.log('📍Rejoining clusters before performing tests')
  const joined = await joinAllPeers(ips, enodes)
  if (!joined) {
    console.log('📍Unable to join peers before starting tests, exiting')
    process.exit(1)
  }

  console.log('📍Rejoined clusters')
}
