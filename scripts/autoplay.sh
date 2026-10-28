#!/bin/bash
# Nach dem Start warten, bis Spotify per MPRIS erreichbar ist, dann weiterspielen
export DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/xdg-spotify/bus
for i in $(seq 1 60); do
  st=$(playerctl -p spotify status 2>/dev/null)
  if [ -n "$st" ]; then
    sleep 4
    [ "$(playerctl -p spotify status 2>/dev/null)" != "Playing" ] && playerctl -p spotify play
    exit 0
  fi
  sleep 2
done
