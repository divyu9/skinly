#!/bin/zsh
# Packing videos recorded on a phone, made small enough to upload and to play
# on a customer's mobile data: 720p on the short side (portrait or landscape),
# H.264 + AAC MP4 that starts playing before it has fully downloaded.
# The originals are left as they are; the small copies go into "<folder>/compressed".
#
#   zsh tools/compress-packing-videos.sh ~/Downloads/phone-packing
set -e
src="${1:?Give the folder with the phone videos}"
out="$src/compressed"
mkdir -p "$out"
for f in "$src"/*.(mp4|MP4|mov|MOV|m4v|M4V)(N); do
  name="${f:t:r}"
  dst="$out/$name.mp4"
  [[ -f "$dst" ]] && { echo "skip (done): $name"; continue; }
  ffmpeg -hide_banner -loglevel error -y -i "$f" \
    -vf "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'" \
    -c:v libx264 -preset veryfast -crf 28 -r 30 -c:a aac -b:a 96k -movflags +faststart "$dst"
  printf "%-40s %6s MB -> %5s MB\n" "$name" "$(( $(stat -f%z "$f") / 1048576 ))" "$(( $(stat -f%z "$dst") / 1048576 ))"
done
echo "Done: $out"
