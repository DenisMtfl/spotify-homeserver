# SpotifyHomeserver

The official Spotify desktop client runs headless in a Proxmox LXC container (Ubuntu 24.04). Its audio is streamed to the browser via Icecast. A small web app remotes it: player controls, cover art, quality selection, live latency and a status page.

## Architecture

```
Spotify desktop (Xvfb :1, openbox)
   | PulseAudio null sink "ice" (44.1 kHz, float32)
   v
ffmpeg encoders (one systemd unit per format, on demand)
   v
Icecast :8000  (/aac128 always on, /aac192 /aac256 /stream /stream192 /stream128 on demand)

Web remote (python3, :8080)   noVNC (websockify :6080 -> x11vnc :5900)
        \________________ Caddy :8443 (HTTPS + cookie login) ____/
```

- **Controls:** MPRIS via `playerctl` on a fixed D-Bus session, with an `xdotool` key fallback
- **Now playing:** artist, title, cover (proxied via `/cover`), progress
- **Web UI:** desktop, mobile and mini-player layouts, German/English, Media Session API (lock screen), wake lock, quick start
- **Status page:** services, streams and listeners, CPU, RAM, disk, restart buttons (limited sudo rule)
- **Optional:** Spotify Connect device selection via the Spotify Web API (PKCE, set up at `/setup.html`)

## Installation

Two ways to run it. The code is identical. Only the service manager differs (`SERVICE_MANAGER=systemd` or `supervisor`, see `player/svc.py`).

### Option A: Docker / Docker Compose (amd64)

```bash
git clone git@github.com:DenisMtfl/spotify-homeserver.git
cd spotify-homeserver
cp .env.example .env        # set passwords
docker compose up -d --build
```

1. Open `https://<host>:8443` and log in with `WEB_USER` / `WEB_PASSWORD`.
2. Turn the screen on, enter the VNC password and log in to the Spotify client **once**. The login stays in the `spotify-home` volume.
3. Press "Sound on".

Notes:
- Only `linux/amd64` works, because Spotify ships no ARM client. That covers Synology x86 models, Unraid, TrueNAS SCALE and any Linux PC.
- The Spotify Connect device name is the container hostname (`SpotifyHomeserver` in `docker-compose.yml`).
- Logs: `docker logs -f spotify-homeserver`. Status page: `https://<host>:8443/status.html`.
- Expose only port 8443 to the internet.

### Option B: Proxmox LXC (Ubuntu 24.04, systemd)

1. Create an unprivileged Ubuntu 24.04 LXC with `nesting=1`, 3 cores, 3 GB RAM and 12 GB disk.
2. Install the packages listed below.
3. Copy the files to the paths in the layout table.
4. Create the user `spotify` and set `/root/spotify.env`, the icecast passwords and `/home/spotify/.vncpass` (`x11vnc -storepasswd`).
5. Run `systemctl enable --now icecast2 spotify-desktop spotify-enc@aac128 spotify-player-web caddy`.

## Layout

| Path in repo | Target in container |
|---|---|
| `player/` | `/opt/player/` |
| `scripts/run.sh`, `scripts/autoplay.sh` | `/home/spotify/` |
| `systemd/*.service` | `/etc/systemd/system/` |
| `caddy/Caddyfile` | `/etc/caddy/Caddyfile` |
| `icecast/icecast.xml` | `/etc/icecast2/icecast.xml` (set passwords!) |
| `sudoers/spotify-web` | `/etc/sudoers.d/spotify-web` |
| `examples/spotify.env.example` | `/root/spotify.env` (Icecast source password) |
| `docker/`, `docker-compose.yml`, `.env.example` | Docker variant (supervisord instead of systemd) |

## Not included (secrets)

Passwords, the login hash (`/home/spotify/.weblogin.json`), sessions, the Spotify login and profile, the Spotify Web API tokens and the TLS key are **not** in this repository. Placeholders are marked `CHANGE_ME`.

## Packages (Ubuntu 24.04)

`icecast2 ffmpeg xvfb openbox x11vnc novnc websockify pulseaudio pulseaudio-utils dbus-x11 x11-utils xdotool playerctl falkon xdg-utils caddy imagemagick curl` plus `spotify-client` from `repository.spotify.com`.

## Ports

| Port | Service |
|---|---|
| 8080 | web remote, LAN only, no login |
| 8443 | everything behind HTTPS + login (expose only this one) |
| 8000 | Icecast (LAN) |
| 6080 | noVNC (LAN) |
