import {
  getIpsAndEnode,
  getUsersAndHosts,
  joinAllPeers
} from '../common/milestone-utils'

export async function stopReorg() {
  // Get users and hosts
  const { borUsers, borHosts } = await getUsersAndHosts()
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
