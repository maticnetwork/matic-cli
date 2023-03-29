# Provider and Terraform Configuration 

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "4.55.0"
    }
  }
  required_version = ">= 1.2.0"
}

provider "google" {
  project = var.PROJECT_ID
  region  = var.REGION
  zone    = var.ZONE
}

# Network and Subnet Creation
resource "google_compute_network" "vpc_network" {
  name                    = var.NETWORK_NAME
  auto_create_subnetworks = false
  mtu                     = 1460
}
resource "google_compute_subnetwork" "public-subnetwork" {
  name          = var.SUBNET_NAME
  ip_cidr_range = var.SUBNET_CIDR_RANGE
  region        = var.REGION
  network       = google_compute_network.vpc_network.name

}

# Reserve Static IP Address
resource "google_compute_address" "static_ip" {
  count = (var.DOCKERIZED == "yes") ? 1 : (var.VALIDATOR_COUNT + var.SENTRY_COUNT + var.ARCHIVE_COUNT)
  name = format("%s-%s",var.VM_NAME, count.index)
         
}


# GCP Compute VM using Machine Image
resource "google_compute_instance" "node_server" {

  count = (var.DOCKERIZED == "yes") ? 1 : (var.VALIDATOR_COUNT + var.SENTRY_COUNT)

  name         = format("%s-%s",var.VM_NAME, count.index)
  machine_type = (count.index >= var.VALIDATOR_COUNT + var.SENTRY_COUNT) ? var.ARCHIVE_MACHINE_TYPE: var.MACHINE_TYPE

  boot_disk {
    initialize_params {
      image = var.INSTANCE_IMAGE
      size = (count.index >= var.VALIDATOR_COUNT + var.SENTRY_COUNT) ? var.ARCHIVE_DISK_SIZE_GB : var.DISK_SIZE_GB
      type = (count.index >= var.VALIDATOR_COUNT + var.SENTRY_COUNT) ? var.ARCHIVE_VOLUME_TYPE : var.VOLUME_TYPE
    }
  }

  metadata = {
    ssh-keys = "${var.USER}::${file(var.GCE_PUB_KEY_FILE)}"
  }

  network_interface {
    network = google_compute_network.vpc_network.name
    subnetwork = google_compute_subnetwork.public-subnetwork.name

    access_config {
      //IP
      nat_ip = google_compute_address.static_ip[count.index].address
    }
  }
  tags = ["matic-cli"]
  labels = {
    name = "polygon-matic"
  }
}

resource "google_compute_firewall" "firewall_rules" {
  name    = var.FW_RULE_NAME
  network = google_compute_network.vpc_network.name

  allow {
    protocol = "tcp"
    ports    = var.PORTS_LIST
  }
  source_ranges = var.SG_CIDR_BLOCKS
}


# output values
output "cloud" {
  value = "gcp"
}

output "instance_dns_ips" {
  value = google_compute_address.static_ip.*.address
}

output "instance_ids" {
  value = google_compute_instance.node_server.*.name 
}
