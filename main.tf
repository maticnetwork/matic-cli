# terraform provider
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }

  required_version = ">= 1.2.0"
}

# aws provider
provider "aws" {
  region     = var.REGION
}

# ec2 instances
resource "aws_instance" "node_server" {
  count = (var.DOCKERIZED == "yes") ? 1 : (var.VALIDATOR_COUNT + var.SENTRY_COUNT + var.ARCHIVE_COUNT)
  ami                    = var.INSTANCE_AMI
  instance_type          = (count.index >= var.VALIDATOR_COUNT + var.SENTRY_COUNT) ? var.ARCHIVE_INSTANCE_TYPE: var.INSTANCE_TYPE
  key_name               = var.PEM_FILE
  vpc_security_group_ids = [aws_security_group.internet_facing_load_balancer_sg.id]
  subnet_id              = aws_subnet.devnet_public_subnet.id

  # instances' disks
  ebs_block_device {
    device_name = "/dev/sda1"
    volume_size = (count.index >= var.VALIDATOR_COUNT + var.SENTRY_COUNT) ? var.ARCHIVE_DISK_SIZE_GB : var.DISK_SIZE_GB
    volume_type = (count.index >= var.VALIDATOR_COUNT + var.SENTRY_COUNT) ? var.ARCHIVE_VOLUME_TYPE : var.VOLUME_TYPE
    iops = (count.index >= var.VALIDATOR_COUNT + var.SENTRY_COUNT ) ? var.ARCHIVE_IOPS : var.IOPS
  }

  tags = {
    Name = "${var.VM_NAME}_${count.index + 1}"
  }
}

# elastic ips
resource "aws_eip" "eip" {
  vpc = true
  count = (var.DOCKERIZED == "yes") ? 1 : (var.VALIDATOR_COUNT + var.SENTRY_COUNT + var.ARCHIVE_COUNT)
  instance                  = aws_instance.node_server[count.index].id
  depends_on                = [aws_internet_gateway.devnet_internet_gateway]

  tags = {
    Name = "${var.VM_NAME}_${count.index + 1}_eip"
  }
}

# elastic ips association
resource "aws_eip_association" "eip_association" {
  count = (var.DOCKERIZED == "yes") ? 1 : (var.VALIDATOR_COUNT + var.SENTRY_COUNT + var.ARCHIVE_COUNT)
  instance_id   = aws_instance.node_server[count.index].id
  allocation_id = aws_eip.eip[count.index].id
}

# security group
resource "aws_security_group" "internet_facing_load_balancer_sg" {
  name        = "internet_facing_loadbalancer_sg"
  description = "security group attached to internet facing loadbalancer"
  vpc_id      = aws_vpc.devnet_vpc.id

  dynamic "ingress" {
    for_each = toset(var.PORTS_IN)
    content {
      description = "web traffic from internet"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = concat(var.SG_CIDR_BLOCKS, [aws_vpc.devnet_vpc.cidr_block])
      self = true
    }
  }
  dynamic "egress" {
    for_each = toset(var.PORTS_OUT)
    content {
      description = "web traffic to internet"
      from_port   = egress.value
      to_port     = egress.value
      protocol    = "-1"
      cidr_blocks = var.SG_CIDR_BLOCKS_OUT
      self = true
    }
  }
  tags = {
    Name = "${var.VM_NAME}_internet_facing_loadbalancer_sg"
  }
}


# public subnet
variable "devnet_public_subnet" {
  default     = "10.0.0.0/24"
  description = "devnet_public_subnet"
  type        = string
}

resource "aws_subnet" "devnet_public_subnet" {
  vpc_id                  = aws_vpc.devnet_vpc.id
  cidr_block              = var.devnet_public_subnet
  availability_zone       = "us-west-2a"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.VM_NAME}_public_subnet"
  }
}


# vpc
resource "aws_vpc" "devnet_vpc" {
  cidr_block           = "10.0.0.0/16"
  instance_tenancy     = "default"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.VM_NAME}_vpc"
  }
}

# internet gateway
resource "aws_internet_gateway" "devnet_internet_gateway" {
  vpc_id = aws_vpc.devnet_vpc.id
  tags = {
    Name = "${var.VM_NAME}_intenet_gateway"
  }
}

# route table
resource "aws_route_table" "devnet_route_table" {
  vpc_id = aws_vpc.devnet_vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.devnet_internet_gateway.id
  }
  tags = {
    Name = "${var.VM_NAME}_route_table"
  }
}

# route table association
resource "aws_main_route_table_association" "route_table_association" {
  vpc_id         = aws_vpc.devnet_vpc.id
  route_table_id = aws_route_table.devnet_route_table.id
}

# output variables used by express-cli
output "instance_ips" {
  value = aws_eip.eip.*.public_ip
}

output "instance_dns_ips" {
  value = aws_eip.eip.*.public_dns
}

output "instance_ids" {
  value = aws_instance.node_server.*.id
}
