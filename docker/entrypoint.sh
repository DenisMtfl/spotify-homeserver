#!/bin/bash
# Erststart-Einrichtung fuer den Docker-Container, danach uebernimmt supervisord
set -e

: "${ICECAST_SOURCE_PASSWORD:?ICECAST_SOURCE_PASSWORD fehlt (siehe .env.example)}"
: "${ICECAST_ADMIN_PASSWORD:?ICECAST_ADMIN_PASSWORD fehlt}"
: "${WEB_USER:=admin}"
: "${WEB_PASSWORD:?WEB_PASSWORD fehlt}"
: "${VNC_PASSWORD:?VNC_PASSWORD fehlt}"
export ICEPW="$ICECAST_SOURCE_PASSWORD"

H=/home/spotify
chown spotify:spotify "$H"
mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix   # Xvfb runs as non-root

# Skripte an den Ort, den die Dienste erwarten
install -o spotify -g spotify -m 755 /opt/spotify-scripts/run.sh /opt/spotify-scripts/autoplay.sh "$H/"

# Icecast: Passwoerter aus der Umgebung eintragen
sed -e "s#<source-password>[^<]*</#<source-password>${ICECAST_SOURCE_PASSWORD}</#" \
    -e "s#<relay-password>[^<]*</#<relay-password>${ICECAST_SOURCE_PASSWORD}</#" \
    -e "s#<admin-password>[^<]*</#<admin-password>${ICECAST_ADMIN_PASSWORD}</#" \
    /etc/icecast2/icecast.xml.template > /etc/icecast2/icecast.xml
chown -R icecast2:icecast /var/log/icecast2 2>/dev/null || true

# Web-Login (gehasht) aus WEB_USER / WEB_PASSWORD
python3 - <<'PY'
import hashlib, json, os, secrets
s = secrets.token_bytes(16)
h = hashlib.pbkdf2_hmac('sha256', os.environ['WEB_PASSWORD'].encode(), s, 200000).hex()
p = '/home/spotify/.weblogin.json'
json.dump({'user': os.environ['WEB_USER'], 'salt': s.hex(), 'hash': h}, open(p, 'w'))
os.chmod(p, 0o600)
PY
chown spotify:spotify "$H/.weblogin.json"

# VNC-Passwort
su spotify -c "x11vnc -storepasswd '$VNC_PASSWORD' $H/.vncpass" >/dev/null 2>&1

# Selbstsigniertes Zertifikat (bleibt im Volume erhalten)
mkdir -p "$H/.certs"
if [ ! -f "$H/.certs/cert.pem" ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=SpotifyHomeserver" \
    -addext "subjectAltName=DNS:SpotifyHomeserver,DNS:localhost${TLS_EXTRA_SAN:+,$TLS_EXTRA_SAN}" \
    -keyout "$H/.certs/key.pem" -out "$H/.certs/cert.pem" >/dev/null 2>&1
fi
chmod 600 "$H/.certs/key.pem"
cp "$H/.certs/cert.pem" "$H/.certs/key.pem" /etc/caddy/certs/

# Spotify-Qualitaet "Sehr hoch", sobald ein Profil existiert
for p in "$H"/.config/spotify/Users/*/prefs; do
  [ -f "$p" ] || continue
  sed -i '/^audio\.\(play\|sync\)_bitrate\(_non_metered\)\?_enumeration=/d' "$p"
  printf 'audio.play_bitrate_enumeration=4\naudio.play_bitrate_non_metered_enumeration=4\naudio.sync_bitrate_enumeration=4\n' >> "$p"
done

mkdir -p /run/supervisor
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
