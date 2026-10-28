#!/bin/bash
export DISPLAY=:1
export QTWEBENGINE_DISABLE_SANDBOX=1
export QTWEBENGINE_CHROMIUM_FLAGS=--disable-gpu
export XDG_RUNTIME_DIR=/tmp/xdg-spotify
mkdir -p -m 700 $XDG_RUNTIME_DIR
export DBUS_SESSION_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/bus
rm -f $XDG_RUNTIME_DIR/bus
dbus-daemon --session --address=$DBUS_SESSION_BUS_ADDRESS --fork --nopidfile
pulseaudio --start --exit-idle-time=-1 --log-target=syslog
sleep 1
pactl load-module module-null-sink sink_name=ice rate=44100 format=float32le channels=2 sink_properties=device.description=ice >/dev/null
Xvfb :1 -screen 0 1280x800x24 &
sleep 2
openbox &
x11vnc -display :1 -forever -shared -rfbauth /home/spotify/.vncpass -rfbport 5900 -localhost -quiet &
websockify --web /usr/share/novnc 6080 localhost:5900 &
rm -f /home/spotify/.cache/spotify/Singleton*
PULSE_SINK=ice spotify --no-sandbox --disable-gpu --disable-dev-shm-usage &
(/home/spotify/autoplay.sh &)
wait
