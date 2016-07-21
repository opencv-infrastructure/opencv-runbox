#!/bin/bash
mkdir -p log
mkdir -p data/templates
mkdir -p data/workspaces
mkdir -p data/sessions
sudo service runbox-service restart
sudo service nginx restart
