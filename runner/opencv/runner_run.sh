#!/bin/bash
cd "$( dirname "${BASH_SOURCE[0]}" )"

if [ -z "$1" ]; then
  echo Specify code dir
fi

CODEDIR=$1
if [ -f "${CODEDIR}/.run_id" ]; then
  STATUS=`./runner_query.sh ${CODEDIR}`
  if [[ "${STATUS}" == "#NOTFOUND" ]]; then
    rm -f "${CODEDIR}/.run_id"
  else
    echo "#INVALID"
    exit 1
  fi
fi
INSTANCEID=${2:-"00000"}

RUNBOX_TARGET=${RUNBOX_TARGET:-OpenCV_CPP}

mkdir -p ${CODEDIR}/output
. target/${RUNBOX_TARGET}/prepare.sh ${CODEDIR}

INSTANCEID=$(docker run -d \
-c 256 --memory=1G --memory-swap=0 \
-h ocv${INSTANCEID} \
--name runbox_opencv_instance_${INSTANCEID} \
--env RUNBOX_TARGET=${RUNBOX_TARGET} \
-v $(pwd):/app:ro \
-v ${CODEDIR}/src:/data/src:ro \
-v ${CODEDIR}/output:/data/output \
-v ${CODEDIR}/input:/data/output/input:ro \
runbox_opencv_image)

echo ${INSTANCEID} > "${CODEDIR}/.run_id"
