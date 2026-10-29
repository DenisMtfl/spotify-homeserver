#!/bin/bash
export DISPLAY=:1
export QTWEBENGINE_DISABLE_SANDBOX=1
export QTWEBENGINE_CHROMIUM_FLAGS=--disable-gpu
export XDG_RUNTIME_DIR=/tmp/xdg-spotify
mkdir -p -m 700 $XDG_RUNTIME_DIR
# Leftovers from a previous start (PulseAudio and D-Bus detach and survive a service restart)
pkill -u "$(id -u)" -x pulseaudio 2>/dev/null
pkill -u "$(id -u)" -x dbus-daemon 2>/dev/null
pkill -u "$(id -u)" -x Xvfb 2>/dev/null
sleep 1
rm -f /tmp/.X1-lock /tmp/.X11-unix/X1
export DBUS_SESSION_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/bus
rm -f $XDG_RUNTIME_DIR/bus
dbus-daemon --session --address=$DBUS_SESSION_BUS_ADDRESS --fork --nopidfile
# PulseAudio ohne Hardware-Module: nur die virtuelle Soundkarte "ice", von der ffmpeg aufnimmt
pulseaudio --start -n --exit-idle-time=-1 --log-target=${PA_LOG_TARGET:-syslog} --load=module-native-protocol-unix
sleep 1
pactl load-module module-null-sink sink_name=ice rate=44100 format=float32le channels=2 sink_properties=device.description=ice >/dev/null
pactl set-default-sink ice
Xvfb :1 -screen 0 1280x800x24 &
sleep 2
openbox &
x11vnc -display :1 -forever -shared -rfbauth /home/spotify/.vncpass -rfbport 5900 -localhost -quiet &
websockify --web /usr/share/novnc 6080 localhost:5900 &
rm -f /home/spotify/.cache/spotify/Singleton*
PULSE_SINK=ice spotify --no-sandbox --disable-gpu --disable-dev-shm-usage &
(/home/spotify/autoplay.sh &)
wait
