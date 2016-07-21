#!/bin/bash -e
virtualenv -p python3 ../penv
../penv/bin/pip install -r requirements.txt
