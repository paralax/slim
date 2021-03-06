#!/bin/bash

SCRIPTPATH="$( cd "$(dirname "$0")" ; pwd -P )"

# Prepare and reset build directories
WORKDIR=~/.slim
mkdir -p $WORKDIR
cd $WORKDIR
rm -rf alpine-tmp alpine-vm
rm -rf file.img.gz file.img

# terminate early if commands fail
set -e 
set -o pipefail


# Use docker to build image
docker build -t alpine-vm --build-arg SSHPUBKEY="$(cat $SCRIPTPATH/keys/baker.pub)" $1
# Run a container and use export/import to flatten layers
ID=$(docker run -it -d alpine-vm sh)
docker export $ID | docker import - alpine-vm-flat
docker save alpine-vm-flat > alpine.tar
docker stop $ID
docker rm $ID

mkdir -p alpine-tmp alpine-vm
mv alpine.tar alpine-tmp
cd alpine-tmp && tar -xvf alpine.tar
mv */layer.tar ../alpine-vm
echo "extracting layer.tar"
# Use gnu-tar
# https://github.com/docker/for-mac/issues/1578
cd ../alpine-vm && gtar -xf layer.tar
rm layer.tar

#echo "copy randomness"
#cat /dev/urandom | head -c 5000 > etc/random-seed || echo $?

echo "creating file.img"
find . | cpio -o -H newc > $WORKDIR/file.img;
cd $WORKDIR
echo "compressing img"
gzip file.img
#cp file.img.gz $SCRIPTPATH/file.img.gz