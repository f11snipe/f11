#!/bin/bash

rhost=${1:-$VMIP}
rport=${2:-$PORT}

valid_ip="^([0-9]{1,3}\.){3}[0-9]{1,3}$"
valid_port="^[0-9]+$"

if [[ $rhost =~ $valid_ip ]] && [[ $rport =~ $valid_port ]]; then
  RHOST=$rhost RPORT=$rport node /home/charlie/dev/f11snipe/f11/src/wfi.js
fi
