#!/bin/bash

# install node
apt-get update -y
apt install nodejs npm -y

# set up project
git clone https://github.com/visionsofparadise/casheye-address-watcher.git
cd casheye-address-watcher
XLH_LOGS=true
STAGE=
npm i
npm run compile
npm run test
npm run startd