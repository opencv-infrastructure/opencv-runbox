#!/bin/bash

CONFIG=${BUILD_CONFIG:-Release}

run_cmd() {
  echo "$*"
  $*
}

set -e
cd /data/build
echo "#"
echo "# Configure..."
echo "#"
run_cmd cmake -DOpenCV_DIR=/app/prebuild/opencv_build_${CONFIG}/install/share/OpenCV /data/src
echo "#"
echo "# Build..."
echo "#"
run_cmd cmake --build . --config ${CONFIG}
echo "#"
echo "# Run..."
echo "#"
cd /data/output
/usr/bin/time --verbose /data/build/bin/app $(< /data/src/command_args) 2>&1
echo "#"
echo "# Exit code $?"
echo "#"
