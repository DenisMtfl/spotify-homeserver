#!/bin/bash
# Installation von SpotifyHomeserver in einem frischen Ubuntu-24.04-LXC (oder einer VM) mit systemd.
# Aufruf als root im geklonten Repo:
#   WEB_PASSWORD='...' VNC_PASSWORD='...' ./scripts/install-lxc.sh
# Optional: WEB_USER (Standard admin), ICECAST_SOURCE_PASSWORD, ICECAST_ADMIN_PASSWORD (sonst zufaellig),
#           TLS_EXTRA_SAN (z. B. "DNS:spotify.example.org,IP:192.168.1.50")
# Erneut ausfuehren = Update: Programmdateien werden ersetzt, Passwoerter nur neu gesetzt, wenn angegeben.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Bitte als root ausfuehren"; exit 1; }
cd "$(dirname "$0")/.."
REPO=$(pwd)
H=/home/spotify
rand() { openssl rand -hex "${1:-8}"; }
log() { echo -e "\n== $*"; }

log "Pakete installieren"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg openssl python3 sudo \
  icecast2 ffmpeg xvfb openbox x11vnc novnc websockify x11-utils xdotool \
  pulseaudio pulseaudio-utils dbus dbus-x11 playerctl falkon xdg-utils \
  fonts-dejavu-core libnss3 libgbm1 libasound2t64 caddy
if ! dpkg -s spotify-client >/dev/null 2>&1; then
  log "Spotify-Client aus dem offiziellen Spotify-Repository"
  curl -fsSL https://download.spotify.com/debian/pubkey_5384CE82BA52C83A.gpg | gpg --dearmor --yes -o /usr/share/keyrings/spotify.gpg
  echo "deb [signed-by=/usr/share/keyrings/spotify.gpg] http://repository.spotify.com stable non-free" > /etc/apt/sources.list.d/spotify.list
  apt-get update && apt-get install -y spotify-client
fi

log "Benutzer spotify"
id spotify >/dev/null 2>&1 || useradd -m -s /bin/bash spotify

log "Programmdateien"
mkdir -p /opt/player
cp -r "$REPO"/player/. /opt/player/
rm -rf /opt/player/__pycache__
chmod 755 /opt/player/enc.sh
chown -R spotify:spotify /opt/player
install -m 755 -o spotify -g spotify "$REPO"/scripts/run.sh "$REPO"/scripts/autoplay.sh "$H/"
mkdir -p "$H/.config"
[ -f "$H/.config/mimeapps.list" ] || printf '[Default Applications]\nx-scheme-handler/http=org.kde.falkon.desktop\nx-scheme-handler/https=org.kde.falkon.desktop\ntext/html=org.kde.falkon.desktop\n' > "$H/.config/mimeapps.list"
chown -R spotify:spotify "$H/.config"
cp "$REPO"/systemd/*.service /etc/systemd/system/
install -m 440 "$REPO"/sudoers/spotify-web /etc/sudoers.d/spotify-web
visudo -cf /etc/sudoers.d/spotify-web

log "Icecast"
if [ -n "${ICECAST_SOURCE_PASSWORD:-}" ] || [ ! -f /root/spotify.env ]; then
  ICEPW=${ICECAST_SOURCE_PASSWORD:-$(rand 8)}
  ICEADM=${ICECAST_ADMIN_PASSWORD:-$(rand 8)}
  sed -e "s#<source-password>[^<]*<#<source-password>$ICEPW<#" \
      -e "s#<relay-password>[^<]*<#<relay-password>$ICEPW<#" \
      -e "s#<admin-password>[^<]*<#<admin-password>$ICEADM<#" \
      "$REPO"/icecast/icecast.xml > /etc/icecast2/icecast.xml
  chown icecast2:icecast /etc/icecast2/icecast.xml 2>/dev/null || chown icecast2 /etc/icecast2/icecast.xml
  chmod 640 /etc/icecast2/icecast.xml
  echo "ICEPW=$ICEPW" > /root/spotify.env
  chmod 600 /root/spotify.env
  echo "Icecast-Admin-Passwort: $ICEADM  (Seite http://<IP>:8000/admin/, Benutzer admin)"
fi
[ -f /etc/default/icecast2 ] && sed -i 's/^ENABLE=.*/ENABLE=true/' /etc/default/icecast2

log "Web-Login (Port 8443)"
if [ -n "${WEB_PASSWORD:-}" ] || [ ! -f "$H/.weblogin.json" ]; then
  if [ -z "${WEB_PASSWORD:-}" ]; then WEB_PASSWORD=$(rand 6); echo "Erzeugtes Web-Passwort: ${WEB_USER:-admin} / $WEB_PASSWORD"; fi
  WEB_USER="${WEB_USER:-admin}" WEB_PASSWORD="$WEB_PASSWORD" python3 - <<'PY'
import hashlib, json, os, secrets
s = secrets.token_bytes(16)
p = '/home/spotify/.weblogin.json'
json.dump({'user': os.environ['WEB_USER'], 'salt': s.hex(),
           'hash': hashlib.pbkdf2_hmac('sha256', os.environ['WEB_PASSWORD'].encode(), s, 200000).hex()}, open(p, 'w'))
os.chmod(p, 0o600)
PY
  chown spotify:spotify "$H/.weblogin.json"
fi

log "VNC-Passwort"
if [ -n "${VNC_PASSWORD:-}" ] || [ ! -f "$H/.vncpass" ]; then
  if [ -z "${VNC_PASSWORD:-}" ]; then VNC_PASSWORD=$(rand 4); echo "Erzeugtes VNC-Passwort: $VNC_PASSWORD"; fi
  runuser -u spotify -- x11vnc -storepasswd "$VNC_PASSWORD" "$H/.vncpass" >/dev/null 2>&1
fi

log "Caddy (HTTPS + Login auf 8443)"
cp "$REPO"/caddy/Caddyfile /etc/caddy/Caddyfile
mkdir -p /etc/caddy/certs /var/log/caddy
if [ ! -f /etc/caddy/certs/cert.pem ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=SpotifyHomeserver" \
    -addext "subjectAltName=DNS:SpotifyHomeserver,DNS:localhost${TLS_EXTRA_SAN:+,$TLS_EXTRA_SAN}" \
    -keyout /etc/caddy/certs/key.pem -out /etc/caddy/certs/cert.pem >/dev/null 2>&1
fi
chmod 600 /etc/caddy/certs/key.pem
chown -R caddy:caddy /etc/caddy/certs /var/log/caddy

log "Dienste starten"
systemctl daemon-reload
systemctl enable icecast2 spotify-desktop spotify-enc@aac128 spotify-player-web caddy
systemctl restart icecast2 spotify-desktop spotify-enc@aac128 spotify-player-web caddy
sleep 5
systemctl --no-pager --lines=0 status icecast2 spotify-desktop spotify-enc@aac128 spotify-player-web caddy | grep -E '^[^ ]|Active:' || true

IP=$(hostname -I | awk '{print $1}')
cat <<EOF

Fertig. Naechste Schritte:
  1. http://$IP:8080 oeffnen, VNC-Passwort eingeben und im Spotify-Fenster einmal anmelden
  2. "Ton an" druecken
  Von aussen: nur Port 8443 freigeben -> https://$IP:8443 (Login)
EOF
