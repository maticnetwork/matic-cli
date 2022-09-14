variable "ACCESS_KEY" {
    type = string
}

variable "SECRET_KEY" {
    type = string
}

variable "VALIDATOR_COUNT" {
    default = "2"
}

variable "SENTRY_COUNT" {
    default = "1"
}

variable "INSTANCE_TYPE" {
    default = "t2.micro"
}

variable "INSTANCE_AMI" {
  default = "ami-08d70e59c07c61a3a"
}

variable "PEM_FILE" {
  default = "shivam-matic"
}

variable "REGION" {
  default = "us-west-2"
}

variable "SG_CIDR_BLOCKS" {
    default = ["0.0.0.0/0"]
}

// set ports to be opened in security group for incoming 
variable "PORTS_IN" {
    default = [80, 443, 30303, 1317, 8545, 9545, 1337, 8546]
}

// to allow all ports to outside, set to [0]
variable "PORTS_OUT" {
    default = [0]
}
