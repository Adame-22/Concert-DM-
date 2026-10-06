#!/bin/sh
# Tourne puis monte la vidéo de présentation : ./outils/video/tourner.sh [sortie.mp4]
# Il faut Node, Playwright (Chromium) et ffmpeg. Le serveur local sert le dépôt sur le port 8765.
set -e
DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$DIR/../.." && pwd)
OUT=${1:-$DIR/sono-sim-presentation.mp4}
python3 -m http.server 8765 --directory "$ROOT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
node "$DIR/record.js"   # images + repères
node "$DIR/music.js"    # musique calée sur les repères
"$DIR/build.sh" "$OUT"  # assemblage MP4
