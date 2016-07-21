#!/bin/bash

if [ -f /app/deploy/env.sh ]; then
  . /app/deploy/env.sh
fi

virtualenv --system-site-packages /env
. /env/bin/activate

pip install numpy
