import { loadDevnetConfig } from '../common/config-utils.js'
import { timer } from '../common/time-utils.js'
import {
  runSshCommand,
  runSshCommandWithReturn,
  maxRetries
} from '../common/remote-worker.js'
import { isValidatorIdCorrect } from '../common/validators-utils.js'
import dotenv from 'dotenv'

export async function sendGovTestsCommand(validatorID) {
  dotenv.config({ path: `${process.cwd()}/.env` })
  const devnetType =
    process.env.TF_VAR_DOCKERIZED === 'yes' ? 'docker' : 'remote'

  const doc = await loadDevnetConfig(devnetType)
  let machine0

  if (
    !isValidatorIdCorrect(
      validatorID,
      doc.numOfBorValidators + doc.numOfErigonValidators
    )
  ) {
    console.log(
      '📍Invalid validatorID used, please try with a valid argument! Exiting...'
    )
    process.exit(1)
  }
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
      await runSshCommand(
        `${doc.ethHostUser}@${machine}`,
        `printf $'test-test\\ntest-test\\n' | heimdalld keys import-hex test ${hexKey.trim()} --home /var/lib/heimdall`,
        maxRetries
      )
      console.log(`✅ Validator private key imported on host ${machine}`)
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

  const submitProposalcommand = `printf $'test-test\\ntest-test\\n' | heimdalld tx gov submit-proposal draft_proposal.json --from test --home /var/lib/heimdall/ --chain-id ${chainId.trim()} -y`
  await runSshCommand(
    `${doc.ethHostUser}@${machine0}`,
    submitProposalcommand,
    maxRetries
  )

  await timer(5000)

  // Check proposal count after submission
  const afterCount = await getProposalCount(doc, machine0)
  console.log('🔍 Proposals after submission:', afterCount)

  if (afterCount > beforeCount) {
    console.log('✅ Proposal submitted successfully')
  } else {
    console.log('❌ Proposal submission failed')
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
