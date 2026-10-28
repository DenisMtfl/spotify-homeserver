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
