#!/bin/bash
cd "$( dirname "${BASH_SOURCE[0]}" )"

if [ -z "$1" ]; then
  echo Specify code dir
fi

CODEDIR=$1
if [ ! -f "${CODEDIR}/.run_id" ]; then
    echo "#NOTFOUND"
    exit 1
fi
INSTANCEID=`cat "${CODEDIR}/.run_id"`
if [ -z "$INSTANCEID" ]; then
  echo No Run ID
  exit 1
fi

TIMEOUT=${2:-300}


code=$(timeout "${TIMEOUT}" docker wait "${INSTANCEID}" || true)
docker kill "${INSTANCEID}" > /dev/null

docker logs -t ${INSTANCEID} > ${CODEDIR}/output.log 2>&1
#docker cp ${INSTANCEID}:/data/output ${CODEDIR}
rmdir ${CODEDIR}/output/input > /dev/null &2>1 || true
docker rm -f ${INSTANCEID}
rm "${CODEDIR}/.run_id"

if [ -z "$code" ]; then
  echo "#TIMEOUT" >> ${CODEDIR}/output/.runbox_log
  exit 255
else
  exit $code
fi
