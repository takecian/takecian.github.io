#!/bin/sh

hugo
cd public
git add .
git commit -m "Update"
git push origin master
cd ../

