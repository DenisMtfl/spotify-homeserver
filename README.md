# SpotifyHomeserver

Runs the official Spotify desktop client headless on your own server and streams its audio to any browser. A web interface controls everything: play/pause, next/previous, cover art, progress, quality, volume, latency and a status page. You can also see and operate the Spotify window itself in the browser.

Two variants with identical code:

| | **Docker** | **Proxmox LXC / VM** |
|---|---|---|
| For | Synology (x86), Unraid, TrueNAS, any Linux PC | Proxmox, any Ubuntu 24.04 machine |
| Services | supervisord inside the container | systemd |
| Install | `docker compose up -d --build` | `./scripts/install-lxc.sh` |

Requirements:
- **Spotify Premium.**
- **x86_64 / amd64.** Spotify ships no ARM build for Linux, so a Raspberry Pi or an ARM NAS will not work.
- About 2–3 GB RAM, 2 CPU cores and 10 GB of disk.

The web interface is in German or English, depending on the browser language. Button names below are the English ones.

---

## Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Install with Docker](#install-with-docker)
4. [Install in a Proxmox LXC](#install-in-a-proxmox-lxc)
5. [First start: log in to Spotify](#first-start-log-in-to-spotify)
6. [Usage](#usage)
7. [Access from the internet](#access-from-the-internet)
8. [Corporate networks and proxies: compatible mode](#corporate-networks-and-proxies-compatible-mode)
9. [Optional: device selection (Spotify Connect)](#optional-device-selection-spotify-connect)
10. [Updating](#updating)
11. [Troubleshooting](#troubleshooting)
12. [Ports, files, security](#ports-files-security)

---

## Features

- **Audio in the browser**, selectable:
  - AAC 128 / 192 / 256 kbit/s or MP3 128 / 192 / 320 kbit/s as a live stream with less than one second of latency
  - **Compatible HLS** at 64 / 96 / 128 kbit/s for corporate networks and proxies
- **Controls:** play/pause, next/previous track via MPRIS (`playerctl`), with a keyboard fallback
- **Display:** title, artist, cover, progress, measured latency in ms, data streamed
- **Volume:**
  - per browser
  - for all listeners: the Spotify volume, which is kept on every track change
- **Spotify window in the browser:** via noVNC; without WebSocket it switches to an image mode automatically
- **Interface:**
  - desktop, mobile and mini-player layouts
  - German and English, depending on the browser language
  - lock-screen controls, screen stays on while playing
  - colours taken from the cover
- **Status page:** services, streams and listeners, CPU, RAM, disk, restart buttons
- **Encoders on demand:** only AAC 128 runs all the time. Every other format starts with its first listener and stops after 90 s without listeners.
- **Access from outside:** a single port (8443) with HTTPS and login

## Architecture

```
Spotify desktop client  (virtual display Xvfb :1, window manager openbox)
   │  PulseAudio, virtual sound card "ice" (44.1 kHz)
   ▼
ffmpeg encoders (one per format, on demand)
   ├─► Icecast :8000   /aac128 /aac192 /aac256 /stream128 /stream192 /stream (MP3 320)
   └─► HLS files       /hls64 /hls96 /hls   (2-second segments, for corporate networks)

Web interface (python3, :8080)      noVNC (websockify :6080 → x11vnc :5900)
        └──────────── Caddy :8443 (HTTPS + login) ────────────┘
```

| File | Purpose |
|---|---|
| `player/server.py` | web server and API (controls, volume, HLS, screen, login) |
| `player/svc.py` | starts/stops services: systemd (LXC) or supervisord (Docker) |
| `player/ondemand.py` | starts encoders on demand, stops them when idle |
| `player/enc.sh` | the ffmpeg command for each format |
| `player/screen.py` | screen mode without WebSocket (JPEG frames, mouse and keyboard via xdotool) |
| `scripts/run.sh` | starts D-Bus, PulseAudio, Xvfb, x11vnc, noVNC and Spotify |
| `scripts/install-lxc.sh` | complete installation for LXC/VM |
| `docker/` | Dockerfile, entrypoint, supervisord configuration |

---

## Install with Docker

### 1. Get the repository and set passwords

```bash
git clone https://github.com/DenisMtfl/spotify-homeserver.git
cd spotify-homeserver
cp .env.example .env
nano .env
```

| Variable | Meaning |
|---|---|
| `WEB_USER`, `WEB_PASSWORD` | login for port 8443 (access from outside) |
| `VNC_PASSWORD` | password for the Spotify window (noVNC) |
| `ICECAST_SOURCE_PASSWORD` | internal password between the encoders and Icecast, any value |
| `ICECAST_ADMIN_PASSWORD` | Icecast admin page `http://<host>:8000/admin/` |
| `TLS_EXTRA_SAN` | optional: extra names for the certificate, e.g. `DNS:spotify.example.org,IP:192.168.1.50` |

All required values must be set. Otherwise the container does not start and logs which one is missing.

### 2. Build and start

```bash
docker compose up -d --build
docker compose logs -f        # stop with Ctrl+C
```

The first build takes a few minutes; the image is about 2.5 GB. Then continue with [First start](#first-start-log-in-to-spotify).

### Synology (Container Manager)

1. Copy this repository to the Synology, e.g. `/volume1/docker/spotify-homeserver`. The folder must contain `docker-compose.yml`.
2. In that folder copy `.env.example` to `.env` and enter the passwords. File Station can copy and rename it; edit it with Text Editor.
3. **Container Manager → Project → Create.** Path: choose the folder. Source: "Use existing docker-compose.yml".
4. Create. The image is built and the container starts automatically.

Only Synology models with an Intel or AMD CPU work, ARM models do not.

### What is stored where

| Volume | Content |
|---|---|
| `spotify-home` → `/home/spotify` | Spotify login and settings, web login, sessions, certificate, volume, Spotify API tokens |

As long as the volume exists, the Spotify login is kept, also across updates and rebuilds.

### Notes

- The device name in Spotify Connect is the `hostname` from `docker-compose.yml` (`SpotifyHomeserver`).
- Ports 8080, 8000 and 6080 are meant for the home network only. The page on 8080 loads audio and screen directly from 8000 and 6080, so keep these port numbers, or use 8443 for everything.
- Logs: `docker compose logs -f`. Restart a single service with `docker exec spotify-homeserver supervisorctl restart desktop`.

---

## Install in a Proxmox LXC

### 1. Create the container

In the Proxmox host shell. Adjust the ID `151`, the storage `local-lvm` and the bridge `vmbr0` to your setup:

```bash
pveam update
pveam download local ubuntu-24.04-standard_24.04-2_amd64.tar.zst
pct create 151 local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst \
  --hostname SpotifyHomeserver --cores 3 --memory 3072 --swap 1024 \
  --rootfs local-lvm:12 --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 --features nesting=1 --onboot 1
pct start 151
```

Or in the web UI: **Create CT**, choose Ubuntu 24.04, *Unprivileged container*, and under Options → Features tick **Nesting**.

`pveam available | grep ubuntu-24.04` shows the exact template name. The hostname becomes the device name in Spotify Connect.

### 2. Install

Inside the container (`pct enter 151`):

```bash
apt update && apt install -y git
git clone https://github.com/DenisMtfl/spotify-homeserver.git /root/spotify-homeserver
cd /root/spotify-homeserver
WEB_USER=admin WEB_PASSWORD='your-login-password' VNC_PASSWORD='your-vnc-password' ./scripts/install-lxc.sh
```

The script does everything:
- installs the packages and the official Spotify client
- creates the user `spotify`
- copies the files into place (table below)
- creates the passwords, login and certificate
- sets up and starts all services

At the end it prints the address. Then continue with [First start](#first-start-log-in-to-spotify).

Without `WEB_PASSWORD` or `VNC_PASSWORD` the script generates random passwords and prints them. The Icecast passwords are always random unless you set `ICECAST_SOURCE_PASSWORD` and `ICECAST_ADMIN_PASSWORD`.

### Where the script puts things

| From the repo | Target |
|---|---|
| `player/` | `/opt/player/` |
| `scripts/run.sh`, `scripts/autoplay.sh` | `/home/spotify/` |
| `systemd/*.service` | `/etc/systemd/system/` |
| `sudoers/spotify-web` | `/etc/sudoers.d/spotify-web` (the web interface may only start and stop its own services) |
| `caddy/Caddyfile` | `/etc/caddy/Caddyfile`, certificate in `/etc/caddy/certs/` |
| `icecast/icecast.xml` | `/etc/icecast2/icecast.xml` (with passwords) |
| generated | `/root/spotify.env` (`ICEPW`), `/home/spotify/.weblogin.json`, `/home/spotify/.vncpass` |

Services: `icecast2`, `spotify-desktop`, `spotify-enc@aac128` (always on), `spotify-enc@<format>` (on demand), `spotify-player-web` and `caddy`.

```bash
systemctl status spotify-desktop spotify-player-web
journalctl -u spotify-desktop -f
```

A regular VM or PC with Ubuntu 24.04 works as well, with the same script.

---

## First start: log in to Spotify

1. In the home network open `http://<IP>:8080`. From outside use `https://<address>:8443` and log in with `WEB_USER` and `WEB_PASSWORD`.
2. The Spotify window appears below. Enter the **VNC password**.
3. In the Spotify window click **Log in**. The login page opens in the Falkon browser inside the same window. Log in with your Spotify account.
4. Start a song and click **▶ Sound on** at the top.

The login is saved. After a restart Spotify resumes playback automatically if it was playing before.

Tip: in Spotify set *Settings → Audio quality → Streaming quality* to **Very high**.

---

## Usage

| Control | Function |
|---|---|
| ⏮ ⏯ ⏭ | previous track, play/pause, next track |
| **Sound on / off** | start or stop the stream in this browser |
| **Quality** | stream format (see below) |
| **Volume** | volume in this browser only |
| **Spotify** | server volume for all listeners, kept on every track |
| **Latency** | measured delay behind Spotify, click to jump to live |
| **Streamed** | data used this session and in total (click to reset) |
| **Hide / Show screen** | hide the Spotify window (saves data) |
| **Status** | services, streams, listeners, load, restart buttons |

### Quality levels

| Option | Data | Latency | Use |
|---|---|---|---|
| AAC 128 kbit/s (recommended) | approx. 58 MB/h | < 1 s | default, also on mobile |
| AAC 192 / 256 kbit/s | approx. 86 / 115 MB/h | < 1 s | best quality at home |
| MP3 128 / 192 / 320 kbit/s | approx. 58 / 86 / 144 MB/h | < 1 s | older players (e.g. VLC, internet radios) |
| Compatible HLS 64 kbit/s | approx. 29 MB/h | 3–6 s | corporate network, low data |
| Compatible HLS 96 kbit/s | approx. 43 MB/h | 3–6 s | corporate network |
| Compatible HLS 128 kbit/s | approx. 58 MB/h | 3–6 s | corporate network (automatic choice) |

In the home network the streams also play directly in VLC or an internet radio: `http://<IP>:8000/aac128`, `/stream` and so on.

---

## Access from the internet

Expose **only port 8443**. It is protected by HTTPS and a login. Ports 8080, 8000 and 6080 have no login and belong in the home network only.

### Option A: direct (port forwarding)

In the router (e.g. FRITZ!Box → Internet → Permit Access) forward TCP 8443 to the IP of the server or Docker host. Open it via your dynamic DNS name, e.g. `https://xyz.myfritz.net:8443`.

The certificate is self-signed, so the browser warns once and you confirm. If you don't want that, use option B.

### Option B: behind a reverse proxy (e.g. Synology)

Synology DSM → **Control Panel → Login Portal → Advanced → Reverse Proxy → Create**:

| Field | Value |
|---|---|
| Source: protocol / hostname / port | HTTPS / `spotify.yourname.synology.me` / e.g. `9999` |
| Destination: protocol / hostname / port | **HTTPS** / IP of the server / **8443** |
| Custom header | **Create → WebSocket** (needed for the Spotify window) |

Assign a valid certificate to the source hostname (*Security → Certificate*, e.g. Let's Encrypt), and forward the source port in your router to the Synology.

Make sure the destination is **HTTPS** port **8443**, not 8080. Otherwise there is no login.

---

## Corporate networks and proxies: compatible mode

Many corporate proxies block two things:

1. **Endless downloads.** The normal audio is a continuous stream. The proxy waits for the end to scan it, which never comes, so the page stays at "connecting...".
2. **WebSockets.** noVNC uses them for the Spotify window, which then shows "Failed to connect to server".

For both there is a compatible mode that uses only short, ordinary HTTPS requests. Via port 8443 or the reverse proxy both switch on **automatically**:

- **Audio:** if no audio arrives within 10 s, the page switches to *Compatible HLS 128 kbit/s*. Audio is then loaded as 2-second files, the same way Netflix or YouTube work (hls.js). 64 and 96 kbit/s can be chosen in the quality list.
- **Screen:** on load the page tests a WebSocket. If that fails, it shows the Spotify window as a sequence of images, about 4 per second.
  - Clicks, dragging, scrolling and keyboard input are sent over HTTPS; Ctrl+V pastes text.
  - On a phone the **Keyboard** button opens the on-screen keyboard.
  - The bottom right then reads "Compatible mode (no WebSocket)".

Screen and input in compatible mode require a valid login. In the home network on port 8080 the normal noVNC is used.

Please note: whether you may use this on a corporate network is up to your employer's IT policy. Some companies block such sites with a DNS filter.

---

## Optional: device selection (Spotify Connect)

With the Spotify Web API you can choose in the web interface which device Spotify plays on (phone, speaker, this server). The stream does not need it. Until it is set up, the top bar only shows "Set up device selection" and nothing is polled.

1. Open `http://<IP>:8080/setup.html`.
2. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard):
   - redirect URI exactly `http://127.0.0.1:8080/callback`
   - tick Web API
3. Enter the **Client ID** on the setup page and save.
4. Click **Log in**. The Spotify login opens in the Spotify window on the server; confirm it there.

---

## Updating

**Docker:**
```bash
cd spotify-homeserver
git pull
docker compose up -d --build
```

**LXC:**
```bash
cd /root/spotify-homeserver
git pull
./scripts/install-lxc.sh
```

The script only replaces the program files and restarts the services. Passwords, the Spotify login and the certificate are kept, unless you pass new passwords.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Spotify window is black | Status → restart "Spotify client", or `systemctl restart spotify-desktop` or `docker exec spotify-homeserver supervisorctl restart desktop` |
| "connecting...", but no audio | Is Spotify playing? On a corporate network choose *Compatible HLS*. The status page shows whether the encoders run. |
| Audio stutters | Choose AAC 128 or HLS. Check CPU on the status page (the Spotify client needs about one core). |
| "Failed to connect to server" in the screen | WebSocket blocked: reload the page and compatible mode takes over. Behind a reverse proxy check the *WebSocket* header. |
| Login on 8443 fails | Docker: change `WEB_PASSWORD` in `.env`, then `docker compose up -d`. LXC: `WEB_PASSWORD=new ./scripts/install-lxc.sh`. |
| Not reachable from outside | Check port forwarding in the router, the dynamic DNS name, and that the reverse proxy targets HTTPS:8443. On a corporate network there may be a DNS block. |
| Device missing in Spotify Connect | Open Spotify in the window once and play something. The device name is the hostname. |

Logs:
- **Docker:** `docker compose logs -f`
- **LXC:** `journalctl -u spotify-desktop -u spotify-player-web -u 'spotify-enc@*' -f`

---

## Ports, files, security

| Port | Service | Login |
|---|---|---|
| **8443** | everything over HTTPS (web interface, audio, screen) | **yes**, the only port to expose |
| 8080 | web interface | no, home network only |
| 8000 | Icecast streams | no, home network only |
| 6080 | noVNC | VNC password, home network only |

**Not in this repository (secrets):**
- passwords and the login hash (`/home/spotify/.weblogin.json`)
- sessions
- the Spotify login and profile
- the Spotify API tokens
- the TLS key

Placeholders are marked `CHANGE_ME`. `.env` and `*.pem` are listed in `.gitignore`.

Every commit is checked by GitHub Actions (`.github/workflows/docker.yml`). The test builds the image, starts it and checks:
- services
- audio
- HLS
- screen mode
- login
- volume
- restart
