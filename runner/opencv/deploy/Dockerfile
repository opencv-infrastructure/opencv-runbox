FROM ubuntu:14.04

RUN \
  sed -i 's/# \(.*multiverse$\)/\1/g' /etc/apt/sources.list && \
  apt-get update && \
  apt-get install -y \
    build-essential \
    software-properties-common \
    curl git htop man unzip vim wget ncdu mc nano time \
    && \
  rm -rf /var/lib/apt/lists/*

RUN \
  apt-get update && \
  apt-get install -y \
    python python-dev python-pip python-virtualenv libpython2.7-dev libffi-dev \
    && \
  rm -rf /var/lib/apt/lists/*

RUN \
  dpkg --add-architecture i386 && \
  apt-get update && \
  apt-get install -y \
    cmake build-essential \
    libncurses5:i386 libstdc++6:i386 zlib1g:i386 \
    cgroup-bin \
    zlib1g-dev libjpeg-dev libpng12-dev libtiff5-dev libjasper-dev \
    libgtk2.0-dev \
    libavformat-dev libavformat-extra-54 libswscale-dev \
    ant openjdk-7-jdk openjdk-7-jre \
    && \
  rm -rf /var/lib/apt/lists/*

RUN \
  apt-get update && \
  apt-get install -y \
    tesseract-ocr tesseract-ocr-eng libtesseract-dev libleptonica-dev \
    && \
  rm -rf /var/lib/apt/lists/*

CMD ["/app/deploy/entry.sh"]
