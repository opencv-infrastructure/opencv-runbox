#!/bin/bash

umask 0000
. /env/bin/activate

if [ -f /app/deploy/env.sh ]; then
  . /app/deploy/env.sh
fi

mkdir -p /data/build
mkdir -p /data/output

exec /app/target/${RUNBOX_TARGET}/launch.sh
