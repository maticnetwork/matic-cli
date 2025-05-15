import { loadDevnetConfig } from '../common/config-utils.js'
import { timer } from '../common/time-utils.js'
import {
  runSshCommand,
  runSshCommandWithReturn,
  runSshCommandWithoutExit,
  maxRetries
} from '../common/remote-worker.js'
import { getProposalCount, getProposalStatus } from './gov-tests.js'
import dotenv from 'dotenv'

export async function sendAuthAndBankTestsCommand() {
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

  // JSON content for auth.MsgUpdateParams proposal
  const metadataJson = `{
    "title": "Test Proposal.",
    "authors": [
      "Test Author"
    ],
    "summary": "Test Proposal",
    "details": "Test Proposal",
    "proposal_forum_url": "https://forum.polygon.technology/test",
    "vote_option_context": "This is a test proposal to change the auth params."
  }`

  const proposalJson = `{
    "messages": [
      {
        "@type": "/cosmos.auth.v1beta1.MsgUpdateParams",
        "authority": "0x7b5fe22b5446f7c62ea27b8bd71cef94e03f3df2",
        "params": {
          "max_memo_characters": "512",
          "tx_sig_limit": "1",
          "tx_size_cost_per_byte": "20",
          "sig_verify_cost_ed25519": "600",
          "sig_verify_cost_secp256k1": "1100",
          "max_tx_gas": "10000000",
          "tx_fees": "10000000000000000"
        }
      }
    ],
    "metadata": "ipfs://test",
    "deposit": "1000000000000000000pol",
    "title": "Change auth params.",
    "summary": "Change auth params.",
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

  const submitProposalCommand = `printf 'test-test\\n' | heimdalld tx gov submit-proposal draft_proposal.json --from test --home /var/lib/heimdall/ --chain-id ${chainId.trim()} -y`
  await runSshCommand(
    `${doc.ethHostUser}@${machine0}`,
    submitProposalCommand,
    maxRetries
  )

  await timer(2000)

  // Check proposal count after submission
  const afterCount = await getProposalCount(doc, machine0)
  console.log('🔍 Proposals after submission:', afterCount)

  if (afterCount > beforeCount) {
    console.log('✅ Proposal submitted successfully')
  } else {
    console.log('❌ Proposal submission failed')
  }

  console.log(`📍Depositing 200 POL to proposal #${afterCount}`)
  const depositCommand = `printf 'test-test\\n' | heimdalld tx gov deposit ${afterCount} 200000000000000000000pol --from test --home /var/lib/heimdall/ --chain-id ${chainId.trim()} -y`
  for (const machine of doc.devnetBorHosts) {
    await runSshCommand(
      `${doc.ethHostUser}@${machine}`,
      depositCommand,
      maxRetries
    )
    console.log(`✅ Deposit command executed on host ${machine}`)
    await timer(2000)
  }

  console.log(
    `📍 Casting YES vote on proposal #${afterCount} from each validator…`
  )
  for (const machine of doc.devnetBorHosts) {
    const voteCommand = `printf 'test-test\\n' | heimdalld tx gov vote ${afterCount} yes --from test --home /var/lib/heimdall/ --chain-id ${chainId.trim()} -y`
    runSshCommand(`${doc.ethHostUser}@${machine}`, voteCommand, maxRetries)
    console.log(`✅ Vote command executed on host ${machine}`)
    await timer(2000)
  }

  await timer(75000) // Wait for 75 secs
  console.log('📍Checking proposal status…')

  // Check proposal status
  const status = await getProposalStatus(doc, machine0, afterCount)
  if (status === 'PROPOSAL_STATUS_PASSED') {
    console.log('✅ Proposal passed successfully')
  } else {
    console.error(`❌ Proposal status: ${status}`)
  }

  console.log('✅ auth.MsgUpdateParam Testcase passed')

  console.log('📍 Verifying auth params updated')
  const ok = await verifyAuthParamsUpdate(doc, machine0)
  console.log('🔍 Auth params match expected:', ok)
  if (!ok) throw new Error('Auth params update verification failed')

  console.log('✅ Auth module param update test succeeded')

  // Bank Send Test
  const randomAddress = await runSshCommandWithReturn(
    `${doc.ethHostUser}@${machine0}`,
    "printf 'test-test\\n' | heimdalld keys add random --home /var/lib/heimdall --no-backup --output json 2>/dev/null | awk '/^{/,/}$/p' | jq -r .address",
    maxRetries
  )
  console.log('Random address generated:', randomAddress.trim())

  const sendAmount = '1000000000000000000pol'
  await runSshCommand(
    `${doc.ethHostUser}@${machine0}`,
    `printf 'test-test\\n' | heimdalld tx bank send test ${randomAddress} ${sendAmount} --home /var/lib/heimdall --chain-id ${chainId.trim()} -y`,
    maxRetries
  )

  console.log(`✅ Sent ${sendAmount} from test to random`)
  await timer(2000)

  // Query balance via REST
  const balanceOut = await runSshCommandWithReturn(
    `${doc.ethHostUser}@${machine0}`,
    `curl -s localhost:1317/cosmos/bank/v1beta1/balances/${randomAddress.trim()}`,
    maxRetries
  )

  const balance = JSON.parse(balanceOut).balances[0].amount
  console.log('🔍 Balance of new address:', balance)

  if (balance === sendAmount.replace('pol', '')) {
    console.log('✅ Bank send test passed')
  } else {
    console.error(
      '❌ Bank send test failed, expected:',
      sendAmount,
      'got:',
      balance
    )
  }
}

async function getAuthParams(doc, machine) {
  const out = await runSshCommandWithReturn(
    `${doc.ethHostUser}@${machine}`,
    'curl -s localhost:1317/cosmos/auth/v1beta1/params',
    maxRetries
  )
  return JSON.parse(out).params
}

async function verifyAuthParamsUpdate(doc, machine) {
  const current = await getAuthParams(doc, machine)
  const expected = {
    max_memo_characters: '512',
    tx_sig_limit: '1',
    tx_size_cost_per_byte: '20',
    sig_verify_cost_ed25519: '600',
    sig_verify_cost_secp256k1: '1100',
    max_tx_gas: '10000000',
    tx_fees: '10000000000000000'
  }
  return Object.entries(expected).every(([k, v]) => String(current[k]) === v)
}
