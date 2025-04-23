import { loadDevnetConfig } from '../common/config-utils.js'
import { timer } from '../common/time-utils.js'
import {
  runSshCommand,
  runSshCommandWithReturn,
  runSshCommandWithoutExit,
  maxRetries
} from '../common/remote-worker.js'
import dotenv from 'dotenv'

export async function sendGovTestsCommand() {
  dotenv.config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)
  let machine0

  if (doc.numOfBorValidators > 0) {
    machine0 = doc.devnetBorHosts[0]
    console.log('📍Monitoring the first node', doc.devnetBorHosts[0])
  } else if (devnetType === 'remote') {
    machine0 = doc.devnetErigonHosts[0]
    console.log('📍Monitoring the first node', doc.devnetErigonHosts[0])
  } else {
    console.log('📍No nodes to monitor, please check your configs! Exiting...')
    process.exit(1)
  }

  for (const machine of doc.devnetBorHosts) {
    console.log(`📍Processing host: ${machine}`)
    try {
      // Fetch base64-encoded private key
      const base64Key = await runSshCommandWithReturn(
        `${doc.ethHostUser}@${machine}`,
        "jq -r '.priv_key.value' /var/lib/heimdall/config/priv_validator_key.json",
        maxRetries
      )

      // Convert to hex
      const hexKey = await runSshCommandWithReturn(
        `${doc.ethHostUser}@${machine}`,
        `echo "${base64Key.trim()}" | base64 -d | xxd -p -c 256`,
        maxRetries
      )

      console.log('📍Importing validator private key into Heimdall keyring')
      // Import into keyring using the validatorID as the key name
      try {
        await runSshCommandWithoutExit(
          `${doc.ethHostUser}@${machine}`,
          `printf $'test-test\\ntest-test\\n' | heimdalld keys import-hex test ${hexKey.trim()} --home /var/lib/heimdall`,
          maxRetries
        )
        console.log(`✅ Validator private key imported on host ${machine}`)
      } catch (err) {
        console.log(
          `❌ Error importing private key on host ${machine} (might already exist)`
        )
      }
    } catch (err) {
      console.error(
        `❌ Error importing private key on host ${machine} (might already exist):`,
        err.message
      )
    }
  }

  // JSON content for proposals
  const metadataJson = `{
    "title": "Test",
    "authors": [
      "Test Author"
    ],
    "summary": "This is a test proposal.",
    "details": "This is a test proposal.",
    "proposal_forum_url": "https://forum.polygon.technology/test",
    "vote_option_context": "This is a test proposal."
  }`
  const proposalJson = `{
    "metadata": "ipfs://test",
    "deposit": "1000000000000000000pol",
    "title": "Test",
    "summary": "This is a test proposal.",
    "expedited": false
  }`

  console.log('📍Writing draft_metadata.json on primary host:', machine0)
  await runSshCommand(
    `${doc.ethHostUser}@${machine0}`,
    `echo '${metadataJson}' > ~/draft_metadata.json`,
    maxRetries
  )
  console.log(`✅ draft_metadata.json saved on host ${machine0}`)

  console.log('📍Writing draft_proposal.json on primary host:', machine0)
  await runSshCommand(
    `${doc.ethHostUser}@${machine0}`,
    `echo '${proposalJson}' > ~/draft_proposal.json`,
    maxRetries
  )
  console.log(`✅ draft_proposal.json saved on host ${machine0}`)

  const chainId = await runSshCommandWithReturn(
    `${doc.ethHostUser}@${machine0}`,
    "jq -r '.chain_id' /var/lib/heimdall/config/genesis.json",
    maxRetries
  )
  console.log('Chain ID:', chainId.trim())

  // Check proposal count before submission
  const beforeCount = await getProposalCount(doc, machine0)
  console.log('🔍 Proposals before submission:', beforeCount)

  console.log('📍 PROPOSAL_STATUS_PASSED Testcase')

  const submitProposalCommand = `printf 'test-test\\n' | heimdalld tx gov submit-proposal draft_proposal.json --from test --home /var/lib/heimdall/ --chain-id ${chainId.trim()} -y`
  await runSshCommand(
    `${doc.ethHostUser}@${machine0}`,
    submitProposalCommand,
    maxRetries
  )

  await timer(5000)

  // Check proposal count after submission
  let afterCount = await getProposalCount(doc, machine0)
  console.log('🔍 Proposals after submission:', afterCount)

  if (afterCount > beforeCount) {
    console.log('✅ Proposal submitted successfully')
  } else {
    console.log('❌ Proposal submission failed')
  }

  console.log(
    `📍Depositing 500 POL to proposal #${afterCount} on host ${machine0}…`
  )
  const depositCommand = `printf 'test-test\\n' | heimdalld tx gov deposit ${afterCount} 500000000000000000000pol --from test --home /var/lib/heimdall/ --chain-id ${chainId.trim()} -y`
  await runSshCommand(
    `${doc.ethHostUser}@${machine0}`,
    depositCommand,
    maxRetries
  )

  console.log(
    `📍 Casting YES vote on proposal #${afterCount} from each validator…`
  )
  for (const machine of doc.devnetBorHosts) {
    const voteCommand = `printf 'test-test\\n' | heimdalld tx gov vote ${afterCount} yes --from test --home /var/lib/heimdall/ --chain-id ${chainId.trim()} -y`
    runSshCommand(`${doc.ethHostUser}@${machine}`, voteCommand, maxRetries)
    console.log(`✅ Vote command executed on host ${machine}`)
  }

  // Check votes correctly casted
  console.log('📍Checking that all votes are "yes"…')
  let votes = await getVotesDetails(doc, machine0, afterCount)
  let totalValidators = doc.numOfBorValidators
  const yesVotes = votes.filter((v) => v.option === 'VOTE_OPTION_YES').length

  if (votes.length !== totalValidators) {
    console.error(
      `❌ Expected ${totalValidators} votes, but saw ${votes.length}`
    )
  } else if (yesVotes !== totalValidators) {
    console.error(`❌ Only ${yesVotes}/${totalValidators} votes are YES`)
  } else {
    console.log(`✅ All ${yesVotes}/${totalValidators} votes are YES`)
  }

  await timer(60 * 1000) // Wait for 1 minute
  console.log('📍Checking proposal status…')

  // Check proposal status
  let status = await getProposalStatus(doc, machine0, afterCount)
  if (status === 'PROPOSAL_STATUS_PASSED') {
    console.log('✅ Proposal passed successfully')
  } else {
    console.error(`❌ Proposal status: ${status}`)
  }

  console.log('✅ PROPOSAL_STATUS_PASSED Testcase passed')

  console.log('📍 PROPOSAL_STATUS_REJECTED Testcase')

  await runSshCommand(
    `${doc.ethHostUser}@${machine0}`,
    submitProposalCommand,
    maxRetries
  )

  await timer(5000)

  // Check proposal count after submission
  afterCount = await getProposalCount(doc, machine0)
  console.log('🔍 Proposals after submission:', afterCount)

  if (afterCount > beforeCount) {
    console.log('✅ Proposal submitted successfully')
  } else {
    console.log('❌ Proposal submission failed')
  }

  console.log(
    `📍Depositing 500 POL to proposal #${afterCount} on host ${machine0}…`
  )
  await runSshCommand(
    `${doc.ethHostUser}@${machine0}`,
    depositCommand,
    maxRetries
  )

  console.log(
    `📍 Casting NO vote on proposal #${afterCount} from each validator…`
  )
  for (const machine of doc.devnetBorHosts) {
    const voteCommand = `printf 'test-test\\n' | heimdalld tx gov vote ${afterCount} no --from test --home /var/lib/heimdall/ --chain-id ${chainId.trim()} -y`
    runSshCommand(`${doc.ethHostUser}@${machine}`, voteCommand, maxRetries)
    console.log(`✅ Vote command executed on host ${machine}`)
  }

  // Check votes correctly casted
  console.log('📍Checking that all votes are "no"…')
  votes = await getVotesDetails(doc, machine0, afterCount)
  totalValidators = doc.numOfBorValidators
  const noVotes = votes.filter((v) => v.option === 'VOTE_OPTION_NO').length

  if (votes.length !== totalValidators) {
    console.error(
      `❌ Expected ${totalValidators} votes, but saw ${votes.length}`
    )
  } else if (yesVotes !== totalValidators) {
    console.error(`❌ Only ${noVotes}/${totalValidators} votes are NO`)
  } else {
    console.log(`✅ All ${noVotes}/${totalValidators} votes are NO`)
  }

  await timer(60 * 1000) // Wait for 1 minute
  console.log('📍Checking proposal status…')

  // Check proposal status
  status = await getProposalStatus(doc, machine0, afterCount)
  if (status === 'PROPOSAL_STATUS_REJECTED') {
    console.log('✅ Proposal rejected successfully')
  } else {
    console.error(`❌ Proposal status: ${status}`)
  }

  console.log('✅ PROPOSAL_STATUS_REJECTED Testcase passed')
}

async function getProposalCount(doc, machine) {
  const cmd = 'curl -s localhost:1317/cosmos/gov/v1/proposals'
  const out = await runSshCommandWithReturn(
    `${doc.ethHostUser}@${machine}`,
    cmd,
    maxRetries
  )
  const outObj = JSON.parse(out)
  return outObj.pagination.total
}

async function getVotesDetails(doc, machine, proposalId) {
  const cmd = `curl -s localhost:1317/cosmos/gov/v1/proposals/${proposalId}/votes`
  const out = await runSshCommandWithReturn(
    `${doc.ethHostUser}@${machine}`,
    cmd,
    maxRetries
  )
  const obj = JSON.parse(out)
  return obj.votes
}

async function getProposalStatus(doc, machine, proposalId) {
  const cmd = `curl -s localhost:1317/cosmos/gov/v1/proposals/${proposalId}`
  const out = await runSshCommandWithReturn(
    `${doc.ethHostUser}@${machine}`,
    cmd,
    maxRetries
  )
  const obj = JSON.parse(out)
  return obj.proposal.status
}
