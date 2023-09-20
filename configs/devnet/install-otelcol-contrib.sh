#!/bin/bash

{ # Prevent execution if this script was only partially downloaded
set -e

oops() {
    echo "$0:" "$@" >&2
    exit 1
}

umask 0022

tmpDir="$(mktemp -d -t otel-collector-contrib-XXXXXXXXXXX || \
          oops "Can't create temporary directory for downloading files")"
cleanup() {
    rm -rf "$tmpDir"
}
trap cleanup EXIT INT QUIT TERM

otel_version="0.85.0"

baseUrl="https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${otel_version}"
binary="otelcol-contrib_${otel_version}_linux_amd64.deb"

url="${baseUrl}/${binary}"
package=$tmpDir/$binary

if command -v curl > /dev/null 2>&1; then
    fetch() { curl -L "$1" -o "$2"; }
elif command -v wget > /dev/null 2>&1; then
    fetch() { wget "$1" -O "$2"; }
else
    oops "you don't have wget or curl installed, which I need to download the binary package"
fi

echo "Downloading otelcol-contrib binary package from '$url' to '$tmpDir'..."
fetch "$url" "$package" || oops "failed to download '$url'"

echo "Removing existing installation..."
sudo dpkg -r otelcol-contrib

echo "Installing $package ..."
sudo dpkg -i $package

echo "open collector contrib has been installed successfully!"

} # End of wrapping
