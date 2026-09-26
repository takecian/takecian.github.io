#!/bin/sh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

hugo
cd public
git add .
git commit -m "Update"
git push -f origin master
cd ../

