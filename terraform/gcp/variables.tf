# Global Variables

variable "PROJECT_ID" {
  type = string
  description = "GCP Project ID"
}

variable "REGION" {
  type = string
  description = "Region of the GCP Resouce in which it needs to be provisioned"
  default = "us-central1"
}

variable "ZONE" {
  type = string
  description = "Zone of the GCP Resource in hich it needs to be provisioned"
  default = "us-central1-a"
}

variable "DOCKERIZED" {
  default = "no"
}

# Network and Subnet Creation

variable "NETWORK_NAME" {
  type = string
  description = "Name of the GCP compute network"
  default = "devnet"
}

variable "SUBNET_NAME" {
  type = string
  description = "Name of the subnetwork in GCP Project" 
  default = "devnet-subnetwork" 
}

variable "SUBNET_CIDR_RANGE" {
  type = string
  description = "CIDR range for the Subnetwork"  
  default = "10.0.0.0/16"
}

variable "FW_RULE_NAME" {
  type = string
  description = "Name for the GCP firewall ingress rules"
  default = "devnet-ingress"
}

variable "PORTS_LIST" {
  type = list
  description = "List of all the required port numbers for the matic CLI"
  default = [22, 80, 443, 30303, 1317, 8545, 9545, 1337, 8546, 26656]
}

# Compute Instance Variables

variable "VM_NAME" {
  type    = string
  default = "polygon-user"
}

variable "MACHINE_TYPE" {
  default = "c3-highcpu-22"
  description = "Type of the Compute VM instance"
}

variable "ARCHIVE_MACHINE_TYPE" {
  default = "c3-highcpu-22"
  description = "Type of the Compute VM instance"
}

variable "DISK_SIZE_GB" {
  default = "100"
}

variable "ARCHIVE_DISK_SIZE_GB" {
  default = "100"
}

variable "VOLUME_TYPE" {
  default = "pd-ssd"
}

variable "ARCHIVE_VOLUME_TYPE" {
  default = "pd-ssd"
}

variable "VALIDATOR_COUNT" {
  default = "2"
}

variable "SENTRY_COUNT" {
  default = "1"
}

variable "ARCHIVE_COUNT" {
  default = "0"
}

variable "INSTANCE_IMAGE" {
  default = "ubuntu-2204-jammy-v20230302"
}

variable "USER" {
  type = string
  default = "ubuntu"
}

variable "GCE_PUB_KEY_FILE" {
  type = string
}

variable "SG_CIDR_BLOCKS" {
  type = list
}
