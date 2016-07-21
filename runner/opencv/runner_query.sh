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

STATUS=`docker ps -q -f "NAME=${INSTANCEID}"`
if [ ! -z "${STATUS}" ]; then
  echo "#RUN"
  IS_RUN=1
else
  STATUS=`docker ps -aq -f "NAME=${INSTANCEID}"`
  if [ ! -z "${STATUS}" ]; then
    echo "#STOPED"
  else
    echo "#NOTFOUND"
    rm "${CODEDIR}/.run_id"
  fi
fi
exit 0
