#!/bin/bash

if [ -f /app/deploy/env.sh ]; then
  . /app/deploy/env.sh
fi

if [ -d /data ]; then
  chown -R appuser:appgroup /data > /dev/null 2>&1
  exec su - appuser -c "RUNBOX_TARGET=${RUNBOX_TARGET} /app/deploy/launch.sh > /data/output/.runbox_log 2>&1"
fi

if [ -f /app/deploy/.prepare_done ]; then
  echo "Preparation step have been done. Remove deploy/.prepare_done to run it again"
else
  /app/deploy/prepare_root.sh || exit 1
  su - appuser -c /app/deploy/prepare_user.sh || exit 1
  touch /app/deploy/.prepare_done
  chown appuser:appgroup /app/deploy/.prepare_done
fi

echo Container build mode
/bin/bash
