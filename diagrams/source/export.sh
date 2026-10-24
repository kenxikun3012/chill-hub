#!/bin/sh
# usage: export.sh <file.drawio> <out-dir> <prefix> <page-count>
DRAWIO="/c/Program Files/draw.io/draw.io.exe"
mkdir -p "$2"
i=0
while [ $i -lt "$4" ]; do
  n=$(printf "%02d" $((i + 1)))
  "$DRAWIO" --export --format png --page-index $((i + 1)) --scale 1.5 --border 20 --output "$2/$3-$n.png" "$1" >/dev/null 2>&1
  i=$((i + 1))
done
ls "$2"
