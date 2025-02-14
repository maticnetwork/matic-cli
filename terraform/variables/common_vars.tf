variable "VM_NAME" {
  type    = string
  default = "polygon-user"
}

variable "BOR_DISK_SIZE_GB" {
  type    = number
  default = 20
}

variable "ERIGON_DISK_SIZE_GB" {
  type    = number
  default = 20
}

variable "BOR_ARCHIVE_DISK_SIZE_GB" {
  type    = number
  default = 100
}

variable "ERIGON_ARCHIVE_DISK_SIZE_GB" {
  type    = number
  default = 100
}

variable "DOCKERIZED" {
  type    = string
  default = "no"
}

variable "BOR_VALIDATOR_COUNT" {
  type    = number
  default = 2
}

variable "ERIGON_VALIDATOR_COUNT" {
  type    = number
  default = 0
}

variable "BOR_SENTRY_COUNT" {
  type    = number
  default = 1
}


variable "ERIGON_SENTRY_COUNT" {
  type    = number
  default = 0
}

variable "BOR_ARCHIVE_COUNT" {
  type    = number
  default = 0
}

variable "ERIGON_ARCHIVE_COUNT" {
  type    = number
  default = 0
}

variable "SG_CIDR_BLOCKS" {
  description = "Contains allowed IPs. Please, set them into secret.tfvars (example available at secret.tfvars.example)"
  sensitive = true
  type =  list(string)
}

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
