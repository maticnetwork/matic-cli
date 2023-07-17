variable "PROJECT_ID" {
  type    = string
}

variable "BOR_PERSISTENT_DISK_TYPE" {
  type    = string
  default = "pd-ssd"
}

variable "ERIGON_PERSISTENT_DISK_TYPE" {
  type    = string
  default = "pd-ssd"
}

variable "BOR_ARCHIVE_PERSISTENT_DISK_TYPE" {
  type    = string
  default = "pd-balanced"
}

variable "ERIGON_ARCHIVE_PERSISTENT_DISK_TYPE" {
  type    = string
  default = "pd-balanced"
}

variable "BOR_MACHINE_TYPE" {
  type    = string
  default = "e2-micro"
}

variable "ERIGON_MACHINE_TYPE" {
  type    = string
  default = "e2-micro"
}

variable "BOR_ARCHIVE_MACHINE_TYPE" {
  type    = string
  default = "e2-micro"
}

variable "ERIGON_ARCHIVE_MACHINE_TYPE" {
  type    = string
  default = "e2-micro"
}

variable "INSTANCE_IMAGE" {
  type    = string
  default = "ubuntu-2204-jammy-v20230302"
}

variable "GCP_REGION" {
  type    = string
  default = "europe-west2"
}

variable "ZONE" {
  type    = string
  default = "europe-west2-a"
}

variable "GCE_PUB_KEY_FILE" {
  type    = string
}

variable "SUBNET_CIDR_RANGE" {
  type = string
}

variable "FW_RULE_SUFFIX" {
  type = string
  default = "fw-rule"
}

variable "USER" {
  type = string
}