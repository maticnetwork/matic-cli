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
  region     = var.REGION
}

resource "aws_instance" "app_server" {
  count = (var.DOCKERIZED == "yes") ? 1 : (var.VALIDATOR_COUNT + var.SENTRY_COUNT + var.ARCHIVE_COUNT)
  ami                    = var.INSTANCE_AMI
  instance_type          = (count.index >= var.VALIDATOR_COUNT + var.SENTRY_COUNT) ? var.ARCHIVE_INSTANCE_TYPE: var.INSTANCE_TYPE
  key_name               = var.PEM_FILE
  vpc_security_group_ids = [aws_security_group.internet_facing_alb.id]
  subnet_id              = aws_subnet.public-subnet-1.id

  ebs_block_device {
    device_name = "/dev/sda1"
    volume_size = (count.index >= var.VALIDATOR_COUNT + var.SENTRY_COUNT) ? var.ARCHIVE_DISK_SIZE_GB : var.DISK_SIZE_GB
    volume_type = (count.index >= var.VALIDATOR_COUNT + var.SENTRY_COUNT) ? var.ARCHIVE_VOLUME_TYPE : var.VOLUME_TYPE
    iops = (count.index >= var.VALIDATOR_COUNT + var.SENTRY_COUNT ) ? var.ARCHIVE_IOPS : var.IOPS
  }

  tags = {
    Name = "${var.VM_NAME}-terraform-${count.index + 1}"
  }
}

resource "aws_eip" "eip" {
  vpc = true
  count = (var.DOCKERIZED == "yes") ? 1 : (var.VALIDATOR_COUNT + var.SENTRY_COUNT + var.ARCHIVE_COUNT)
  instance                  = aws_instance.app_server[count.index].id
  depends_on                = [aws_internet_gateway.gw]
}

resource "aws_eip_association" "eip_assoc" {
  count = (var.DOCKERIZED == "yes") ? 1 : (var.VALIDATOR_COUNT + var.SENTRY_COUNT + var.ARCHIVE_COUNT)
  instance_id   = aws_instance.app_server[count.index].id
  allocation_id = aws_eip.eip[count.index].id
}

resource "aws_security_group" "internet_facing_alb" {
  name        = "internetfacing-loadbalancer-sg"
  description = "Security group attached to internet facing loadbalancer"
  vpc_id      = aws_vpc.My_VPC.id

  dynamic "ingress" {
    for_each = toset(var.PORTS_IN)
    content {
      description = "Web Traffic from internet"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = concat(var.SG_CIDR_BLOCKS, [aws_vpc.My_VPC.cidr_block])
      self = true
    }
  }
  dynamic "egress" {
    for_each = toset(var.PORTS_OUT)
    content {
      description = "Web Traffic to internet"
      from_port   = egress.value
      to_port     = egress.value
      protocol    = "-1"
      cidr_blocks = var.SG_CIDR_BLOCKS_OUT
      self = true
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
  cidr_block              = var.Public_Subnet_1
  availability_zone       = "us-west-2a"
  map_public_ip_on_launch = true
  tags                    = {
    Name = "public-subnet-1"
  }
}


# create the VPC
resource "aws_vpc" "My_VPC" {
  cidr_block           = "10.0.0.0/16"
  instance_tenancy     = "default"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.VM_NAME}-express-cli-vpc"
  }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.My_VPC.id

}

resource "aws_route_table" "table" {
  vpc_id = aws_vpc.My_VPC.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }
}

resource "aws_main_route_table_association" "route_table_assoc" {
  vpc_id         = aws_vpc.My_VPC.id
  route_table_id = aws_route_table.table.id
}

variable "Public_Subnet_1" {
  default     = "10.0.0.0/24"
  description = "Public_Subnet_1"
  type        = string
}

output "instance_ips" {
  value = aws_eip.eip.*.public_ip
}
#output "instance_ips_1" {
#  value = aws_eip.eip.*.public_dns
#}
#output "instance_ips_2" {
#  value = aws_vpc.My_VPC.cidr_block
#}
#output "instance_ips_3" {
#  value = aws_instance.app_server.*.public_ip
#}

output "instance_ids" {
  value = aws_instance.app_server.*.id
}
