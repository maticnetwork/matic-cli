## Simulation tests for milestones

Milestone feature in the PoS V1 chain aims to make the finality of chain more deterministic rather than probabilistic. As it introduces explicit finality, it affects lot of people operating on the chain. The simulation based tests help to generate different scenarios and test the feature effectively.

### Branches to use and some exceptions

The base features for milestone are present in `vaibhav/Milestone` branch for both bor and heimdall.

As the simulation based tests are developed by keeping some assumptions in mind, some changes on top of this branch will be required for it to work accurately and such changes will be dynamic based on the devnet. As the tests creates partitions/clusters in the network, there is a need to deterministically create conditions where 1 cluster has high difficulty but is on a minority (< 2/3+1) fork while another cluster has lower difficulty but is on a majority (> 2/3+1) fork.

In order to achieve such scenario, you'd need to hardcode the primary producer in bor (more details below) so that 1 particular node always has higher difficulty as compared to others (because it's primary every time).

### Steps to make changes in branch

1. Get the validator address of the 1st node (via contracts or logging into the machine itself).
2. For making the changes, visit `consensus/bor/valset/validator_set.go` file and in the `GetProposer()` function of `ValidatorSet` struct, add the following code snippet.

```go
if len(vals.Validators) == 0 {
	return nil
}

for _, val := range vals.Validators {
  if strings.EqualFold(strings.ToLower(val.Address.String()), strings.ToLower("ADDRESS")) {
    vals.Proposer = val.Copy() // replace proposer
    break
  }
}
```

The `ADDRESS` here refers to the validator address obtained in step 1.

3. Update this changes in a branch and update bor of all the nodes.
4. To confirm if changes have correctly applied, you should see that node 1 (whose `ADDRESS` is used) will always mine blocks while other will never mine blocks and will keep syncing.

### Tests and commands

- `../../bin/express-cli.js --milestone-base`

  - This command runs the base milestone tests. The base tests creates 2 clusters where one of them has lower difficulty but high majority to propose milestones and another one has high difficulty to dominate the traditional fork choice rule but lower voting power to propose a milestone. Ideally, with the milestone feature, the fork which has the milestone (here the lower difficulty one) should be considered canonical and 'finalized'.

- `../../bin/express-cli.js --milestone-partition`

  - This command runs the 50:50 partition based milestone tests. The base tests creates 2 clusters where none of them has majority to propose new milestones. The network should behave ideally in such cases and when those clusters connect, expected behaviour should be observed and new milestones should start getting proposed.

### Some points to note

- You'll need to run a devnet of >= 4 validators in order for the tests to run.
