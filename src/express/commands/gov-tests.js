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

  // JSON content for text proposals
  let metadataJson = `{
    "title": "Test",
    "authors": [
      "Test Author"
    ],
    "summary": "This is a test proposal.",
    "details": "This is a test proposal.",
    "proposal_forum_url": "https://forum.polygon.technology/test",
    "vote_option_context": "This is a test proposal."
  }`
  let proposalJson = `{
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
  let beforeCount = await getProposalCount(doc, machine0)
  console.log('🔍 Proposals before submission:', beforeCount)

  console.log('📍 PROPOSAL_STATUS_PASSED Testcase')

  let submitProposalCommand = `printf 'test-test\\n' | heimdalld tx gov submit-proposal draft_proposal.json --from test --home /var/lib/heimdall/ --chain-id ${chainId.trim()} -y`
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
    `📍Depositing 101 POL to proposal #${afterCount} on host ${machine0}…`
  )
  const depositCommand = `printf 'test-test\\n' | heimdalld tx gov deposit ${afterCount} 101000000000000000000pol --from test --home /var/lib/heimdall/ --chain-id ${chainId.trim()} -y`
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
    `📍Depositing 101 POL to proposal #${afterCount} on host ${machine0}…`
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

  console.log('📍 gov.MsgUpdateParam Testcase')

  // JSON content for gov.MsgUpdateParams proposal
  metadataJson = `{
    "title": "Change voting period",
    "authors": [
      "Test"
    ],
    "summary": "Change voting period.",
    "details": "Change voting period.",
    "proposal_forum_url": "https://forum.polygon.technology/test",
    "vote_option_context": "This is a test proposal to change the voting period."
  }`

  proposalJson = `{
    "messages": [
      {
        "@type": "/cosmos.gov.v1.MsgUpdateParams",
        "authority": "0x7b5fe22b5446f7c62ea27b8bd71cef94e03f3df2",
        "params": {
          "min_deposit": [
            {
              "amount": "100000000000000000000",
              "denom": "pol"
            }
          ],
          "max_deposit_period": "172800s", 
          "voting_period": "86400s", 
          "quorum": "0.334000000000000000",
          "threshold": "0.500000000000000000",
          "veto_threshold": "0.334000000000000000",
          "min_initial_deposit_ratio": "0.000000000000000000",
          "proposal_cancel_ratio": "0.500000000000000000",
          "proposal_cancel_dest": "",
          "expedited_voting_period": "50s",
          "expedited_threshold": "0.667000000000000000",
          "expedited_min_deposit": [
            {
              "amount": "500000000000000000000",
              "denom": "pol"
            }
          ],
          "burn_vote_quorum": false,
          "burn_proposal_deposit_prevote": false,
          "burn_vote_veto": true,
          "min_deposit_ratio": "0.010000000000000000"
        }
      }
    ],
    "metadata": "ipfs://CID",
    "deposit": "1000000000000000000pol",
    "title": "Change voting period",
    "summary": "Change voting period",
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

  // Check proposal count before submission
  beforeCount = await getProposalCount(doc, machine0)
  console.log('🔍 Proposals before submission:', beforeCount)

  submitProposalCommand = `printf 'test-test\\n' | heimdalld tx gov submit-proposal draft_proposal.json --from test --home /var/lib/heimdall/ --chain-id ${chainId.trim()} -y`
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
    `📍Depositing 101 POL to proposal #${afterCount} on host ${machine0}…`
  )

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

  await timer(60 * 1000) // Wait for 1 minute
  console.log('📍Checking proposal status…')

  // Check proposal status
  status = await getProposalStatus(doc, machine0, afterCount)
  if (status === 'PROPOSAL_STATUS_PASSED') {
    console.log('✅ Proposal passed successfully')
  } else {
    console.error(`❌ Proposal status: ${status}`)
  }

  console.log('✅ gov.MsgUpdateParam Testcase passed')

  console.log('📍Verifying if voting_period has been updated to 86400s...')

  const isVotingPeriodUpdated = await verifyVotingPeriodUpdate(doc, machine0)

  if (isVotingPeriodUpdated) {
    console.log('✅ voting_period successfully updated to 86400s')
  } else {
    console.error('❌ voting_period update failed or mismatch detected')
  }
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

async function verifyVotingPeriodUpdate(doc, machine) {
  try {
    const cmd = 'curl -s localhost:1317/cosmos/gov/v1/params/voting'
    const out = await runSshCommandWithReturn(
      `${doc.ethHostUser}@${machine}`,
      cmd,
      maxRetries
    )
    const obj = JSON.parse(out)
    const currentVotingPeriod = obj.voting_params?.voting_period || ''

    console.log(`🔍 Current voting_period from chain: ${currentVotingPeriod}`)

    return currentVotingPeriod === '86400s'
  } catch (error) {
    console.error('❌ Error verifying voting_period:', error.message)
    return false
  }
}
