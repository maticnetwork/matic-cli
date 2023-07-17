variable "AWS_PROFILE" {
  type    = string
  default = "default"
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
  default = "ami-01dd271720c1ba44f"
}

variable "PEM_FILE" {
  default = "aws-key"
}

variable "AWS_REGION" {
  default = "eu-west-1"
}

variable "AVAILABILITY_ZONE" {
  default = "eu-west-1a"
}

variable "SG_CIDR_BLOCKS_OUT" {
  default = ["0.0.0.0/0"]
}

// to allow all ports to outside, set to [0]
variable "PORTS_OUT" {
  default = [0]
}
