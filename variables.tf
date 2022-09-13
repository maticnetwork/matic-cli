variable "access_key" {
    default = "ACCESS_KEY"
}

variable "secret_key" {
    default = "SECRET_KEY"
}

variable "validator_count" {
    default = "2"
}

variable "sentry_count" {
    default = "1"
}

variable "instance_type" {
    default = "t2.micro"
}

variable "instance_ami" {
  default = "ami-08d70e59c07c61a3a"
}

variable "pem_file" {
  default = "shivam-matic"
}

variable "region" {
  default = "us-west-2"
}

variable "sg-cidr-blocks" {
    default = ["0.0.0.0/0"]
}

// set ports to be opened in security group for incoming 
variable "ports_in" {
    default = [80, 443, 30303, 1317, 8545, 9545, 1337, 8546]
}

variable "ports_out" {
    default = [0]
}
