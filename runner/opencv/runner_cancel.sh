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
  exit 0
fi

docker kill "${INSTANCEID}" > /dev/null

exit 0
