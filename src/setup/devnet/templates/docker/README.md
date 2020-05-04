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