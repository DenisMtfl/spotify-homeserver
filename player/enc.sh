#!/bin/bash
# Ein Encoder pro Stream: enc.sh <mount>
case "$1" in
  stream)    C="-c:a libmp3lame -b:a 320k -content_type audio/mpeg -f mp3" ;;
  stream192) C="-c:a libmp3lame -b:a 192k -content_type audio/mpeg -f mp3" ;;
  stream128) C="-c:a libmp3lame -b:a 128k -content_type audio/mpeg -f mp3" ;;
  aac256)    C="-c:a aac -aac_coder twoloop -b:a 256k -content_type audio/aac -f adts" ;;
  aac192)    C="-c:a aac -aac_coder twoloop -b:a 192k -content_type audio/aac -f adts" ;;
  aac128)    C="-c:a aac -aac_coder twoloop -b:a 128k -content_type audio/aac -f adts" ;;
  hls)       C="" ; BR=128k ;;
  hls96)     C="" ; BR=96k ;;
  hls64)     C="" ; BR=64k ;;
  *) echo "unbekannter Stream $1"; exit 2 ;;
esac
for i in $(seq 1 30); do [ -S "$XDG_RUNTIME_DIR/pulse/native" ] && break; sleep 1; done
if [ -n "$BR" ]; then
  # HLS: 2-Sekunden-Dateien statt Dauerstream (kommt auch durch Firmen-Proxys)
  D=/tmp/$1; mkdir -p "$D"; rm -f "$D"/*
  exec ffmpeg -loglevel warning -f pulse -sample_rate 44100 -channels 2 -i ice.monitor -ac 2 -ar 44100 \
    -c:a aac -aac_coder twoloop -b:a $BR -f hls -hls_time 2 -hls_list_size 6 \
    -hls_flags delete_segments+omit_endlist+temp_file -hls_segment_filename "$D/seg%06d.ts" "$D/live.m3u8"
fi
exec ffmpeg -loglevel warning -f pulse -sample_rate 44100 -channels 2 -i ice.monitor -ac 2 -ar 44100 $C -ice_name "Spotify-$1" "icecast://source:${ICEPW}@127.0.0.1:8000/$1"
