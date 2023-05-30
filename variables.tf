variable "AWS_PROFILE" {
  type    = string
  default = "default"
}

variable "VM_NAME" {
  type    = string
  default = "polygon-user"
}

variable "BOR_DISK_SIZE_GB" {
  default = "20"
}

variable "ERIGON_DISK_SIZE_GB" {
  default = "20"
}

variable "BOR_ARCHIVE_DISK_SIZE_GB" {
  default = "100"
}

variable "ERIGON_ARCHIVE_DISK_SIZE_GB" {
  default = "100"
}

variable "BOR_IOPS" {
  default = 3000
}

variable "ERIGON_IOPS" {
  default = 3000
}
variable "BOR_ARCHIVE_IOPS" {
  default = 3000
}

variable "ERIGON_ARCHIVE_IOPS" {
  default = 3000
}

variable "BOR_VOLUME_TYPE" {
  default = "gp3"
}

variable "ERIGON_VOLUME_TYPE" {
  default = "gp3"
}

variable "BOR_ARCHIVE_VOLUME_TYPE" {
  default = "io1"
}

variable "ERIGON_ARCHIVE_VOLUME_TYPE" {
  default = "io1"
}
variable "DOCKERIZED" {
  default = "no"
}

variable "BOR_VALIDATOR_COUNT" {
  default = "2"
}

variable "ERIGON_VALIDATOR_COUNT" {
  default = "0"
}

variable "BOR_SENTRY_COUNT" {
  default = "1"
}


variable "ERIGON_SENTRY_COUNT" {
  default = "0"
}

variable "BOR_ARCHIVE_COUNT" {
  default = "0"
}

variable "ERIGON_ARCHIVE_COUNT" {
  default = "0"
}
variable "BOR_INSTANCE_TYPE" {
  default = "t2.xlarge"
}

variable "ERIGON_INSTANCE_TYPE" {
  default = "r5b.large"
}

variable "BOR_ARCHIVE_INSTANCE_TYPE" {
  default = "t2.xlarge"
}

variable "ERIGON_ARCHIVE_INSTANCE_TYPE" {
  default = "r5b.large"
}

variable "INSTANCE_AMI" {
  default = "ami-017fecd1353bcc96e"
}

variable "PEM_FILE" {
  default = "aws-key"
}

variable "REGION" {
  default = "us-west-2"
}

variable "SG_CIDR_BLOCKS" {
  description = "Contains allowed IPs. Please, set them into secret.tfvars (example available at secret.tfvars.example)"
  sensitive = true
}

variable "SG_CIDR_BLOCKS_OUT" {
  default = ["0.0.0.0/0"]
}

// set ports to be opened in security group for incoming
variable "PORTS_IN" {
  // 22: ssh
  // 80: http
  // 443: https ssl enabled
  // 30303: p2p bor
  // 1317: heimdall
  // 8545: bor https
  // 8546: bor rpc websockets
  // 9545: ganache
  // 1337:
  // 26656: heimdall comms
  // 8080: hasura console
  // 3000: ethstats-frontend dashboard
  // 8000: ethstats-backend collector
  default = [22, 80, 443, 30303, 1317, 8545, 9545, 1337, 8546, 26656, 8080, 3000, 8000]
}

// to allow all ports to outside, set to [0]
variable "PORTS_OUT" {
  default = [0]
}
