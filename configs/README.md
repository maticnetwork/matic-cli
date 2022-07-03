# Configurations

`matic-cli` can boostrap a local network with a configuration file. The file could be in yaml or json format.

## Usage

```bash
matic-cli setup devnet -c path/to/config.yaml
```

## Option details with examples

```yaml
# The root target directory where everything related to the network will be created
# If not specified, current directory where the CLI is run will be used.
targetDirectory: /absolute/path/to/target/directory

# Default stake for each validator (in matic)
defaultStake: 10000

# Default amount of fee to topup heimdall validator
defaultFee: 2000

# ChainID of bor
borChainId:

# ChainID of heimdall
heimdallChainId:

# Branch of bor to use. Repository: https://github.com/maticnetwork/bor
borBranch: v0.2.16

# Docker build context for bor. When specified, borBranch will be ignore.
# e.g. https://github.com/maticnetwork/bor.git#v0.3.0-dev
borDockerBuildContext: ""

# Branch of Heimdall to use. Repository: https://github.com/maticnetwork/heimdall
heimdallBranch: v0.2.10

# Docker build context for heimdall. When specified, heimdallBranch will be ignore.
# e.g. https://github.com/maticnetwork/heimdall.git#v0.3.0-dev
heimdallDockerBuildContext: ""

# Branch of contract to use. Repostiory: https://github.com/maticnetwork/contracts
contractsBranch: arpit/v0.3.1-backport

# Number of validators to create
numOfValidators: 2

# Number of non-validators (sentry node) to create
numOfNonValidators: 0

# URL to Ethereum RPC
ethURL: http://ganache:9545

# Devnet type, choose from [docker, remote]
devnetType: docker

# IPs of hosts where bor will run. Only effective when devnetType is remote.
devnetBorHosts:
  - 172.20.1.100
  - 172.20.1.101

# IPs of hosts where heimdall will run. Only effective when devnetType is remote.
devnetHeimdallHosts:
  - 172.20.1.100
  - 172.20.1.101

# Users of hosts where bor will run. Only effective when devnetType is remote.
devnetBorUsers:
  - ubuntu
  - ubuntu

# Users where heimdall will run. Only effective when devnetType is remote.
devnetHeimdallUsers:
  - ubuntu
  - ubuntu
```
