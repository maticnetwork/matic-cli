# main.tf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }

  required_version = ">= 1.2.0"
}

provider "aws" {
  region  = var.region
  access_key = var.access_key
  secret_key = var.secret_key
}

resource "aws_instance" "app_server" {
  count         = var.validator_count + var.sentry_count
  ami           = var.instance_ami
  instance_type = var.instance_type
  key_name      = var.pem_file
  vpc_security_group_ids = [aws_security_group.internet_facing_alb.id]
  subnet_id = "${aws_subnet.public-subnet-1.id}"


  tags = {
    Name = "Terraform-${count.index + 1}"
  }
}


resource "aws_security_group" "internet_facing_alb" {
  name        = "internetfacing-loadbalancer-sg"
  description = "Security group attached to internet facing loadbalancer"
  vpc_id = aws_vpc.My_VPC.id

  dynamic "ingress" {
    for_each = toset(var.ports_in)
    content {
      description = "Web Traffic from internet"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = var.sg-cidr-blocks
    }
  }
  dynamic "egress" {
    for_each = toset(var.ports_out)
    content {
      description = "Web Traffic to internet"
      from_port   = egress.value
      to_port     = egress.value
      protocol    = "-1"
      cidr_blocks = var.sg-cidr-blocks
    }
  }
  tags = {
    Name = "internetfacing-loadbalancer-sg"
  }
}


# Create Public Subnet 
# terraform aws create subnet
resource "aws_subnet" "public-subnet-1" {
vpc_id                  = aws_vpc.My_VPC.id
cidr_block              = "${var.Public_Subnet_1}"
availability_zone       = "us-west-2a"
map_public_ip_on_launch = true
tags      = {
Name    = "public-subnet-1"
}
}


# create the VPC
resource "aws_vpc" "My_VPC" {
  cidr_block           = "10.0.0.0/16"
  instance_tenancy     = "default" 
  enable_dns_support   = true 
  enable_dns_hostnames = true

    tags = {
        Name = "Matic-CLI-VPC"
    }
}

variable "Public_Subnet_1" {
default = "10.0.0.0/24"
description = "Public_Subnet_1"
type = string
}

output "instance_ips" {
  value = aws_instance.app_server.*.public_ip
}