# SpotifyHomeserver als Docker-Image (Ubuntu 24.04, nur amd64 – der Spotify-Client gibt es nur fuer x86_64)
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    SERVICE_MANAGER=supervisor \
    PA_LOG_TARGET=stderr \
    XDG_RUNTIME_DIR=/tmp/xdg-spotify

# Basis, Audio, virtueller Bildschirm, noVNC, Steuerung, Webserver
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg openssl python3 sudo supervisor \
        icecast2 ffmpeg \
        xvfb openbox x11vnc novnc websockify x11-utils xdotool imagemagick \
        pulseaudio pulseaudio-utils dbus dbus-x11 playerctl \
        falkon xdg-utils fonts-dejavu-core libnss3 libgbm1 libasound2t64 \
        caddy \
    && rm -rf /var/lib/apt/lists/*

# Offizieller Spotify-Client aus dem Spotify-Repository
RUN curl -fsSL https://download.spotify.com/debian/pubkey_5384CE82BA52C83A.gpg \
        | gpg --dearmor -o /usr/share/keyrings/spotify.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/spotify.gpg] http://repository.spotify.com stable non-free" \
        > /etc/apt/sources.list.d/spotify.list \
    && apt-get update && apt-get install -y --no-install-recommends spotify-client \
    && rm -rf /var/lib/apt/lists/*

# Benutzer und Projektdateien
RUN useradd -m -s /bin/bash spotify
COPY player/ /opt/player/
COPY scripts/run.sh scripts/autoplay.sh /opt/spotify-scripts/
COPY caddy/Caddyfile /etc/caddy/Caddyfile
COPY icecast/icecast.xml /etc/icecast2/icecast.xml.template
COPY docker/supervisord.conf /etc/supervisor/conf.d/spotify-homeserver.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /opt/player/enc.sh /opt/spotify-scripts/*.sh /usr/local/bin/entrypoint.sh \
    && mkdir -p /var/log/caddy /etc/caddy/certs \
    && chown -R spotify:spotify /opt/player

# 8443 = alles mit HTTPS + Login (nur diesen Port nach aussen freigeben)
# 8080 = Weboberflaeche ohne Login (nur LAN), 8000 = Icecast, 6080 = noVNC
EXPOSE 8443 8080 8000 6080

# Spotify-Anmeldung, Login, Zertifikat und Spotify-API-Token bleiben hier erhalten
VOLUME ["/home/spotify"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
