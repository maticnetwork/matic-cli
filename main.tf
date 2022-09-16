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
  region  = var.REGION
  access_key = var.ACCESS_KEY
  secret_key = var.SECRET_KEY
}

resource "aws_instance" "app_server" {
  count         = var.VALIDATOR_COUNT + var.SENTRY_COUNT
  ami           = var.INSTANCE_AMI
  instance_type = var.INSTANCE_TYPE
  key_name      = var.PEM_FILE
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
    for_each = toset(var.PORTS_IN)
    content {
      description = "Web Traffic from internet"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = var.SG_CIDR_BLOCKS
    }
  }
  dynamic "egress" {
    for_each = toset(var.PORTS_OUT)
    content {
      description = "Web Traffic to internet"
      from_port   = egress.value
      to_port     = egress.value
      protocol    = "-1"
      cidr_blocks = var.SG_CIDR_BLOCKS
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

resource "aws_internet_gateway" "gw" { vpc_id = aws_vpc.My_VPC.id}

resource "aws_route_table" "table" {
  vpc_id = "${aws_vpc.My_VPC.id}"
  route {
      cidr_block = "0.0.0.0/0"
      gateway_id = "${aws_internet_gateway.gw.id}"
    }
}

resource "aws_main_route_table_association" "route_table_assoc" {
  vpc_id         = "${aws_vpc.My_VPC.id}"
  route_table_id = "${aws_route_table.table.id}"
}

variable "Public_Subnet_1" {
default = "10.0.0.0/24"
description = "Public_Subnet_1"
type = string
}

output "instance_ips" {
  value = aws_instance.app_server.*.public_ip
}
