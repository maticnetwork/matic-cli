variable "AWS_PROFILE" {
  type    = string
  default = "default"
}

variable "VM_NAME" {
  type    = string
  default = "polygon-user"
}

variable "DISK_SIZE_GB" {
  default = "500"
}

variable "IOPS" {
  default = 3000
}
variable "DOCKERIZED" {
  default = "no"
}

variable "VALIDATOR_COUNT" {
  default = "2"
}

variable "SENTRY_COUNT" {
  default = "1"
}

variable "INSTANCE_TYPE" {
  default = "t2.xlarge"
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
  default = [22, 80, 443, 30303, 1317, 8545, 9545, 1337, 8546, 26656]
}

// to allow all ports to outside, set to [0]
variable "PORTS_OUT" {
  default = [0]
}
