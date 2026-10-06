#!/bin/sh
# Monte la vidéo : images du tournage (frames.txt) + musique (music.wav) → MP4 1080p
set -e
cd "$(dirname "$0")"
OUT=${1:-sono-sim-presentation.mp4}
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i frames.txt -i music.wav \
  -vf "fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 20 -profile:v high -tune animation \
  -c:a aac -b:a 192k -ar 44100 -shortest -movflags +faststart "$OUT"
ffprobe -hide_banner -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
