#!/bin/bash

docker ps -aq -f "NAME=runbox_opencv_instance*" | xargs -n1 -r docker rm -f
