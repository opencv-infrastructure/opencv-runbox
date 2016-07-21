#!/bin/bash -e
set -x
OPENCV_DIR=/app/prebuild/opencv
OPENCV_CONTRIB_DIR=/app/prebuild/opencv_contrib

fetch_code()
{
  SRCDIR=$1
  URL=$2
  mkdir -p ${SRCDIR}
  cd ${SRCDIR}
  git status || git clone --depth=100 $URL .
  git fetch origin master
  git checkout -f origin/master
}

fetch_code $OPENCV_DIR https://github.com/Itseez/opencv.git
fetch_code $OPENCV_CONTRIB_DIR https://github.com/Itseez/opencv_contrib.git

export PYTHON2_EXECUTABLE=/env/bin/python
export PYTHON2_INCLUDE_DIR=/env/include/python2.7

build_config()
{
  CONFIG=$1
  DIR=/app/prebuild/opencv_build_${CONFIG}
  mkdir -p ${DIR}
  cd ${DIR}
  cmake -DBUILD_PERF_TESTS=OFF -DBUILD_TESTS=OFF -DCMAKE_BUILD_TYPE=${CONFIG} -DCMAKE_INSTALL_PREFIX:PATH=${DIR}/install \
    -DOPENCV_EXTRA_MODULES_PATH=${OPENCV_CONTRIB_DIR}/modules ${OPENCV_DIR}
  cmake --build . --config ${CONFIG} --target install -- -j5
}

build_config Release
build_config Debug
