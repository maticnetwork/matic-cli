# Devnet

### Run multiple heimdall nodes

```bash
# start heimdall0
$ docker-compose up -d heimdall0

# exec bash into heimdall0
$ docker exec -i -t heimdall0 bash
```

**To access bash for all nodes**

```bash
$ tmux
$ bash tmux-docker.sh
```

**To read logs**

On docker container's shell:

```bash
$ tail -f /root/heimdall/logs/heimdalld.log
```

### Run multiple bor nodes

```bash
# setup all nodes
$ bash docker-bor-setup.sh

# start node
$ bash docker-bor-start.sh 0 # for node 0

# start all nodes at once
$ bash docker-bor-start-all.sh
```

### Clean Heimdall/Bor data and start fresh

```bash
$ bash docker-clean.sh
```