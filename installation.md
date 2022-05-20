### Matic CLI Dependencies

You'll require following dependencies in order to run matic-cli on a docker based setup

1. Git
2. NPM and Node v10.17.0 (preferrable):</br>
  - If you're running on a fresh machine, we suggest installing things using node version manager (nvm).
  - Refer [this](https://github.com/nvm-sh/nvm#installing-and-updating) for installing/updating nvm
  - Once installed, you can download the required node version using `nvm install 10.17.0` and then run `nvm use 10.17.0` to use it.
  - Cross verify by running `node --version` which should say `v10.17.0`.
3. Go 1.18+:</br>
  Follow the steps below to install the latest go version 1.18.1 (if not already installed) (Note that these are preferrable steps which we use. You can also install go by downloading the package from the official documentation)
  - Download the installation script (OS/Platform independent)
    ```bash
    wget https://raw.githubusercontent.com/maticnetwork/node-ansible/master/go-install.sh
    ```
  - Remove the previous installation
    ```bash
    bash go-install.sh --remove
    ```
  - Install go v1.18.1
    ```bash
    bash go-install.sh
    ```
  - Verify the installation
    ```bash
    go version

    # Should return something like this
    # go version go1.18.1 linux/amd64
    ```
4. Docker:</br>
  Refer [this](https://docs.docker.com/get-docker/) link for platform specific installation steps.

Please note that the rabbit mq, solidity compiler (solc) and ganache-cli is not required to be installed on the machine used for setup, as they'll be installed on docker itself.

Incase the tools fail to install, you can install them using the following commands on docker.

5. Solc:</br>

6. Ganache-cli:</br>
