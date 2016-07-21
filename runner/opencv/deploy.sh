#!/bin/bash
cd "$( dirname "${BASH_SOURCE[0]}" )"

# Settings
if [ ! -f deploy/env.sh ]; then
  cat > deploy/env.sh <<EOF
export APP_UID=$UID
export APP_GID=$GROUPS
EOF
fi

# Build Docker image
docker build -t runbox_opencv_image_prototype deploy

echo "1) Check settings: deploy/env.sh"

echo "2) Run command below to create docker container:"
echo "   docker run -it \
--name runbox_opencv_build \
-v $(pwd):/app \
runbox_opencv_image_prototype"

echo "3) Prepare OpenCV binaries and commit changes into new docker image."
echo "   docker commit runbox_opencv_build runbox_opencv_image"
