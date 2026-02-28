#!/usr/bin/env bash
set -euo pipefail

# compress-video.sh — Compress a video to web-optimized MP4 and extract a poster frame.
#
# Usage:
#   ./scripts/compress-video.sh <input-video>
#   ./scripts/compress-video.sh -f <input-video>   # overwrite existing output
#
# Outputs (in the same directory as the input):
#   <basename>.mp4          — H.264 compressed video
#   <basename>-poster.jpg   — JPEG poster frame from the video midpoint

FORCE=false
if [[ "${1:-}" == "-f" ]]; then
    FORCE=true
    shift
fi

INPUT="${1:-}"

if [[ -z "$INPUT" ]]; then
    echo "Usage: $0 [-f] <input-video>"
    exit 1
fi

if [[ ! -f "$INPUT" ]]; then
    echo "Error: File not found: $INPUT"
    exit 1
fi

DIR="$(dirname "$INPUT")"
BASE="$(basename "$INPUT")"
NAME="${BASE%.*}"

OUTPUT_MP4="$DIR/$NAME.mp4"
OUTPUT_POSTER="$DIR/$NAME-poster.jpg"

# Check if output already exists
if [[ "$FORCE" != true ]]; then
    if [[ -f "$OUTPUT_MP4" ]]; then
        echo "Error: $OUTPUT_MP4 already exists. Use -f to overwrite."
        exit 1
    fi
fi

# Get video duration for midpoint poster frame
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$INPUT")
MIDPOINT=$(echo "$DURATION / 2" | bc -l)

echo "Compressing: $INPUT"
echo "  Duration: ${DURATION}s"

# Compress to H.264 MP4 optimized for web streaming
ffmpeg -y -i "$INPUT" \
    -c:v libx264 -crf 25 -preset slow \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    -pix_fmt yuv420p \
    "$OUTPUT_MP4"

# Extract poster frame from midpoint
ffmpeg -y -i "$INPUT" \
    -ss "$MIDPOINT" \
    -frames:v 1 \
    -q:v 2 \
    "$OUTPUT_POSTER"

INPUT_SIZE=$(stat -f%z "$INPUT" 2>/dev/null || stat --printf="%s" "$INPUT")
OUTPUT_SIZE=$(stat -f%z "$OUTPUT_MP4" 2>/dev/null || stat --printf="%s" "$OUTPUT_MP4")

echo ""
echo "Done!"
echo "  Video:  $OUTPUT_MP4 ($(( OUTPUT_SIZE / 1024 / 1024 ))MB — was $(( INPUT_SIZE / 1024 / 1024 ))MB)"
echo "  Poster: $OUTPUT_POSTER"
