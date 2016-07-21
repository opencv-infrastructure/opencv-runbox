#!/bin/bash

CONFIG=${BUILD_CONFIG:-Release}

run_cmd() {
  echo "$*"
  $*
}

set -e
. /env/bin/activate
echo "#"
echo "# Run..."
echo "#"
cd /data/output
export PYTHONPATH=/app/prebuild/opencv_build_${CONFIG}/install/lib/python2.7/site-packages
export PYTHONUNBUFFERED=1
/usr/bin/time --verbose python /data/src/main.py $(< /data/src/command_args) 2>&1
echo "#"
echo "# Exit code $?"
echo "#"
