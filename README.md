# SpotifyHomeserver

Der offizielle Spotify-Desktop-Client läuft auf deinem eigenen Server ohne Bildschirm. Sein Ton wird als Stream an jeden Browser geschickt. Eine Weboberfläche steuert alles: Play/Pause, vor/zurück, Cover, Fortschritt, Qualität, Lautstärke, Verzögerung, Statusseite. Das Spotify-Fenster selbst siehst und bedienst du ebenfalls im Browser.

Zwei Varianten mit identischem Code:

| | **Docker** | **Proxmox LXC / VM** |
|---|---|---|
| Für | Synology (x86), Unraid, TrueNAS, jeden Linux-PC | Proxmox, jede Ubuntu-24.04-Maschine |
| Dienste | supervisord im Container | systemd |
| Installation | `docker compose up -d --build` | `./scripts/install-lxc.sh` |

Voraussetzungen:
- **Spotify Premium.**
- **x86_64 / amd64.** Spotify gibt es für Linux nicht als ARM-Version, ein Raspberry Pi oder ARM-NAS geht also nicht.
- Etwa 2–3 GB RAM, 2 CPU-Kerne und 10 GB Speicher.

---

## Inhalt

1. [Funktionen](#funktionen)
2. [Aufbau](#aufbau)
3. [Installation mit Docker](#installation-mit-docker)
4. [Installation im Proxmox-LXC](#installation-im-proxmox-lxc)
5. [Erster Start: Spotify anmelden](#erster-start-spotify-anmelden)
6. [Bedienung](#bedienung)
7. [Zugriff von außen](#zugriff-von-außen)
8. [Firmennetz und Proxy: Kompatibel-Modus](#firmennetz-und-proxy-kompatibel-modus)
9. [Optional: Geräteauswahl (Spotify Connect)](#optional-geräteauswahl-spotify-connect)
10. [Update](#update)
11. [Fehlersuche](#fehlersuche)
12. [Ports, Dateien, Sicherheit](#ports-dateien-sicherheit)

---

## Funktionen

- **Ton im Browser**, wählbar:
  - AAC 128 / 192 / 256 kbit/s oder MP3 128 / 192 / 320 kbit/s als Live-Stream mit unter einer Sekunde Verzögerung
  - **Kompatibel HLS** mit 64 / 96 / 128 kbit/s für Firmennetze und Proxys
- **Steuerung:** Play/Pause, nächster/vorheriger Titel über MPRIS (`playerctl`), mit Tastatur-Fallback
- **Anzeige:** Titel, Interpret, Cover, Fortschritt, gemessene Verzögerung in ms, gestreamte Datenmenge
- **Lautstärke:**
  - im Browser
  - für alle Hörer: Spotify-Lautstärke, bleibt bei jedem Titelwechsel erhalten
- **Spotify-Fenster im Browser:** per noVNC; ohne WebSocket automatisch per Bild-Modus
- **Oberfläche:**
  - Desktop, Handy und Mini-Player
  - Deutsch und Englisch, je nach Browsersprache
  - Steuerung vom Sperrbildschirm, Bildschirm bleibt an
  - Farbe passend zum Cover
- **Statusseite:** Dienste, Streams und Hörer, CPU, RAM, Speicher, Neustart-Knöpfe
- **Encoder nur bei Bedarf:** Nur AAC 128 läuft immer, alle anderen Formate starten beim ersten Hörer und gehen nach 90 s ohne Hörer aus
- **Zugang von außen:** nur ein Port (8443), mit HTTPS und Login

## Aufbau

```
Spotify-Desktop-Client  (virtueller Bildschirm Xvfb :1, Fenstermanager openbox)
   │  PulseAudio, virtuelle Soundkarte "ice" (44,1 kHz)
   ▼
ffmpeg-Encoder (je Format einer, bei Bedarf)
   ├─► Icecast :8000   /aac128 /aac192 /aac256 /stream128 /stream192 /stream (MP3 320)
   └─► HLS-Dateien     /hls64 /hls96 /hls   (2-Sekunden-Stücke, für Firmennetze)

Weboberfläche (python3, :8080)      noVNC (websockify :6080 → x11vnc :5900)
        └──────────── Caddy :8443 (HTTPS + Login) ────────────┘
```

| Datei | Aufgabe |
|---|---|
| `player/server.py` | Webserver und API (Steuerung, Lautstärke, HLS, Bild, Login) |
| `player/svc.py` | Dienste starten/stoppen: systemd (LXC) oder supervisord (Docker) |
| `player/ondemand.py` | Encoder bei Bedarf starten, nach Leerlauf stoppen |
| `player/enc.sh` | ffmpeg-Aufruf je Format |
| `player/screen.py` | Bild-Modus ohne WebSocket (JPEG-Bilder, Maus und Tastatur per xdotool) |
| `scripts/run.sh` | startet D-Bus, PulseAudio, Xvfb, x11vnc, noVNC und Spotify |
| `scripts/install-lxc.sh` | komplette Installation für LXC/VM |
| `docker/` | Dockerfile, Startskript, supervisord-Konfiguration |

---

## Installation mit Docker

### 1. Repository holen und Passwörter setzen

```bash
git clone https://github.com/DenisMtfl/spotify-homeserver.git
cd spotify-homeserver
cp .env.example .env
nano .env
```

| Variable | Bedeutung |
|---|---|
| `WEB_USER`, `WEB_PASSWORD` | Login für Port 8443 (Zugang von außen) |
| `VNC_PASSWORD` | Passwort für das Spotify-Fenster (noVNC) |
| `ICECAST_SOURCE_PASSWORD` | internes Passwort zwischen Encodern und Icecast, beliebig lang |
| `ICECAST_ADMIN_PASSWORD` | Icecast-Adminseite `http://<host>:8000/admin/` |
| `TLS_EXTRA_SAN` | optional: weitere Namen für das Zertifikat, z. B. `DNS:spotify.example.org,IP:192.168.1.50` |

Alle Pflichtwerte müssen gesetzt sein, sonst startet der Container nicht und meldet, was fehlt.

### 2. Bauen und starten

```bash
docker compose up -d --build
docker compose logs -f        # mit Strg+C beenden
```

Der erste Build dauert einige Minuten, das Image ist etwa 2,5 GB groß. Danach weiter mit [Erster Start](#erster-start-spotify-anmelden).

### Synology (Container Manager)

1. Den Ordner mit diesem Repository auf die Synology kopieren, z. B. `/volume1/docker/spotify-homeserver`. Darin muss `docker-compose.yml` liegen.
2. In diesem Ordner `.env.example` nach `.env` kopieren und die Passwörter eintragen. Das geht mit File Station über Kopieren und Umbenennen, dann mit dem Texteditor.
3. **Container Manager → Projekt → Erstellen.** Pfad: den Ordner wählen. Quelle: „Vorhandene docker-compose.yml verwenden“.
4. Erstellen. Der Build läuft, danach startet der Container automatisch.

Nur Synology-Modelle mit Intel- oder AMD-CPU funktionieren, ARM-Modelle nicht.

### Was wo gespeichert wird

| Volume | Inhalt |
|---|---|
| `spotify-home` → `/home/spotify` | Spotify-Anmeldung und Einstellungen, Web-Login, Sitzungen, Zertifikat, Lautstärke, Spotify-API-Token |

Solange das Volume bleibt, bleibt auch die Spotify-Anmeldung, auch nach Update oder Neubau.

### Hinweise

- Der Gerätename in Spotify Connect ist der `hostname` aus `docker-compose.yml`, also `SpotifyHomeserver`.
- Die Ports 8080, 8000 und 6080 sind nur fürs Heimnetz gedacht. Die Seite auf 8080 lädt Ton und Bild direkt von 8000 und 6080. Deshalb diese Ports nicht umbiegen, oder ganz über 8443 gehen.
- Logs: `docker compose logs -f`. Ein einzelner Dienst lässt sich neu starten mit `docker exec spotify-homeserver supervisorctl restart desktop`.

---

## Installation im Proxmox-LXC

### 1. Container anlegen

In der Proxmox-Shell (Host). Die ID `151`, den Speicher `local-lvm` und die Bridge `vmbr0` an deine Umgebung anpassen:

```bash
pveam update
pveam download local ubuntu-24.04-standard_24.04-2_amd64.tar.zst
pct create 151 local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst \
  --hostname SpotifyHomeserver --cores 3 --memory 3072 --swap 1024 \
  --rootfs local-lvm:12 --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 --features nesting=1 --onboot 1
pct start 151
```

Oder über die Weboberfläche: **CT erstellen**, dann Ubuntu 24.04, *Unprivilegiert* und bei Optionen → Features **Nesting** anhaken.

Den genauen Namen der Vorlage zeigt `pveam available | grep ubuntu-24.04`. Der Hostname ist später der Gerätename in Spotify Connect.

### 2. Installieren

Im Container (`pct enter 151`):

```bash
apt update && apt install -y git
git clone https://github.com/DenisMtfl/spotify-homeserver.git /root/spotify-homeserver
cd /root/spotify-homeserver
WEB_USER=admin WEB_PASSWORD='dein-login-passwort' VNC_PASSWORD='dein-vnc-passwort' ./scripts/install-lxc.sh
```

Das Skript erledigt alles:
- Pakete und den offiziellen Spotify-Client installieren
- Benutzer `spotify` anlegen
- Dateien an ihren Platz kopieren (Tabelle unten)
- Passwörter, Login und Zertifikat erzeugen
- alle Dienste einrichten und starten

Am Ende zeigt es die Adresse an. Weiter mit [Erster Start](#erster-start-spotify-anmelden).

Ohne `WEB_PASSWORD` oder `VNC_PASSWORD` erzeugt das Skript zufällige Passwörter und gibt sie aus. Die Icecast-Passwörter sind immer zufällig, außer du setzt `ICECAST_SOURCE_PASSWORD` und `ICECAST_ADMIN_PASSWORD`.

### Was das Skript wohin legt

| Aus dem Repo | Ziel |
|---|---|
| `player/` | `/opt/player/` |
| `scripts/run.sh`, `scripts/autoplay.sh` | `/home/spotify/` |
| `systemd/*.service` | `/etc/systemd/system/` |
| `sudoers/spotify-web` | `/etc/sudoers.d/spotify-web` (die Weboberfläche darf nur ihre eigenen Dienste starten und stoppen) |
| `caddy/Caddyfile` | `/etc/caddy/Caddyfile`, Zertifikat in `/etc/caddy/certs/` |
| `icecast/icecast.xml` | `/etc/icecast2/icecast.xml` (mit Passwörtern) |
| erzeugt | `/root/spotify.env` (`ICEPW`), `/home/spotify/.weblogin.json`, `/home/spotify/.vncpass` |

Dienste: `icecast2`, `spotify-desktop`, `spotify-enc@aac128` (immer an), `spotify-enc@<format>` (bei Bedarf), `spotify-player-web` und `caddy`.

```bash
systemctl status spotify-desktop spotify-player-web
journalctl -u spotify-desktop -f
```

Statt LXC geht auch eine normale VM oder ein PC mit Ubuntu 24.04. Das Skript ist dasselbe.

---

## Erster Start: Spotify anmelden

1. Im Heimnetz `http://<IP>:8080` öffnen. Von außen geht es über `https://<adresse>:8443`, dort mit `WEB_USER` und `WEB_PASSWORD` anmelden.
2. Unten erscheint das Spotify-Fenster. Das **VNC-Passwort** eingeben.
3. Im Spotify-Fenster auf **Anmelden** klicken. Die Anmeldeseite öffnet sich im Browser Falkon im selben Fenster. Mit deinem Spotify-Konto anmelden.
4. Einen Song starten und oben **▶ Ton an** drücken.

Die Anmeldung bleibt gespeichert. Nach einem Neustart spielt Spotify automatisch weiter, wenn es vorher gespielt hat.

Tipp: In Spotify unter *Einstellungen → Audioqualität* die Streaming-Qualität auf **Sehr hoch** stellen.

---

## Bedienung

| Element | Funktion |
|---|---|
| ⏮ ⏯ ⏭ | vorheriger Titel, Play/Pause, nächster Titel |
| **Ton an / aus** | Stream im Browser starten oder stoppen |
| **Qualität** | Format des Streams (siehe unten) |
| **Lautstärke** | Lautstärke nur in diesem Browser |
| **Spotify** | Lautstärke am Server für alle Hörer, bleibt bei jedem Titel erhalten |
| **Verzögerung** | gemessener Abstand zu Spotify, Klick springt auf „live“ |
| **Gestreamt** | Datenmenge dieser Sitzung und gesamt (Klick setzt zurück) |
| **Bild aus / an** | Spotify-Fenster ausblenden (spart Daten) |
| **Status** | Dienste, Streams, Hörer, Auslastung, Neustart-Knöpfe |

### Qualitätsstufen

| Auswahl | Datenrate | Verzögerung | Wofür |
|---|---|---|---|
| AAC 128 kbit/s (empfohlen) | ca. 58 MB/h | < 1 s | Standard, auch unterwegs |
| AAC 192 / 256 kbit/s | ca. 86 / 115 MB/h | < 1 s | beste Qualität im Heimnetz |
| MP3 128 / 192 / 320 kbit/s | ca. 58 / 86 / 144 MB/h | < 1 s | für ältere Player (z. B. VLC, Radios) |
| Kompatibel HLS 64 kbit/s | ca. 29 MB/h | 3–6 s | Firmennetz, wenig Daten |
| Kompatibel HLS 96 kbit/s | ca. 43 MB/h | 3–6 s | Firmennetz |
| Kompatibel HLS 128 kbit/s | ca. 58 MB/h | 3–6 s | Firmennetz (automatische Wahl) |

Die Streams lassen sich im Heimnetz auch direkt in VLC oder einem Webradio öffnen: `http://<IP>:8000/aac128`, `/stream` usw.

---

## Zugriff von außen

Freigeben wird **nur Port 8443**. Er ist mit HTTPS und Login geschützt. Die Ports 8080, 8000 und 6080 haben keinen Login und gehören nur ins Heimnetz.

### Variante A: direkt (Portfreigabe)

Im Router (z. B. FRITZ!Box → Internet → Freigaben) TCP 8443 auf die IP des Servers bzw. Docker-Hosts weiterleiten. Aufruf über die DynDNS-Adresse, z. B. `https://xyz.myfritz.net:8443`.

Das Zertifikat ist selbst signiert. Der Browser warnt deshalb einmal, die Warnung bestätigst du. Wer das nicht will, nimmt Variante B.

### Variante B: hinter einem Reverse Proxy (z. B. Synology)

Synology DSM → **Systemsteuerung → Anmeldeportal → Erweitert → Reverse Proxy → Erstellen**:

| Feld | Wert |
|---|---|
| Quelle: Protokoll / Hostname / Port | HTTPS / `spotify.deinname.synology.me` / z. B. `9999` |
| Ziel: Protokoll / Hostname / Port | **HTTPS** / IP des Servers / **8443** |
| Benutzerdefinierter Header | **Erstellen → WebSocket** (nötig für das Spotify-Fenster) |

Für den Quell-Hostnamen ein gültiges Zertifikat zuweisen (*Sicherheit → Zertifikat*, z. B. Let's Encrypt). Im Router den Quell-Port auf die Synology weiterleiten.

Wichtig ist, dass das Ziel **HTTPS** und Port **8443** ist, nicht 8080. Sonst gibt es keinen Login.

---

## Firmennetz und Proxy: Kompatibel-Modus

Viele Firmen-Proxys lassen zwei Dinge nicht durch:

1. **Endlose Downloads.** Der normale Ton ist ein Dauerstream. Der Proxy wartet auf das Ende, um ihn zu prüfen, und das kommt nie. Die Seite bleibt dann bei „verbinde…“ stehen.
2. **WebSockets.** Darüber überträgt noVNC das Spotify-Fenster. Es erscheint dann „Failed to connect to server“.

Für beides gibt es einen Kompatibel-Modus, der nur normale, kurze HTTPS-Anfragen benutzt. Beide schalten sich über Port 8443 bzw. den Reverse Proxy **automatisch** ein:

- **Ton:** Kommt nach 10 s kein Ton, wechselt die Seite auf *Kompatibel HLS 128 kbit/s*. Der Ton wird dann in 2-Sekunden-Dateien geladen, wie bei Netflix oder YouTube (hls.js). 64 und 96 kbit/s kannst du in der Qualitätsliste wählen.
- **Bild:** Die Seite testet beim Laden einen WebSocket. Klappt er nicht, zeigt sie das Spotify-Fenster als Bildfolge mit etwa 4 Bildern pro Sekunde.
  - Klicks, Ziehen, Scrollen und Tastatur werden per HTTPS übertragen, Strg+V fügt Text ein.
  - Auf dem Handy öffnet der Knopf **Tastatur** die Bildschirmtastatur.
  - Unten rechts steht dann „Kompatibel-Modus (ohne WebSocket)“.

Bild und Steuerung im Kompatibel-Modus gibt es nur mit gültigem Login. Im Heimnetz auf 8080 bleibt es beim normalen noVNC.

Bitte beachten: Ob du das im Firmennetz nutzen darfst, regeln die IT-Richtlinien deines Arbeitgebers. Manche Firmen sperren solche Seiten per DNS-Filter.

---

## Optional: Geräteauswahl (Spotify Connect)

Mit der Spotify Web API kannst du in der Weboberfläche wählen, auf welchem Gerät Spotify spielt (Handy, Lautsprecher, dieser Server). Das ist nicht nötig für den Stream. Solange es nicht eingerichtet ist, steht oben nur „Geräteauswahl einrichten“, und es wird nichts abgefragt.

1. `http://<IP>:8080/setup.html` öffnen.
2. Auf [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) eine App anlegen:
   - Redirect URI genau `http://127.0.0.1:8080/callback`
   - Web API anhaken
3. Die **Client ID** auf der Einrichtungsseite eintragen und speichern.
4. Auf **Anmelden** klicken. Die Spotify-Anmeldung öffnet sich im Spotify-Fenster auf dem Server, dort bestätigen.

---

## Update

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

Das Skript ersetzt nur die Programmdateien und startet die Dienste neu. Passwörter, Spotify-Anmeldung und Zertifikat bleiben, außer du übergibst neue Passwörter.

---

## Fehlersuche

| Problem | Lösung |
|---|---|
| Spotify-Fenster schwarz | Status → „Spotify-Client neu starten“, oder `systemctl restart spotify-desktop` bzw. `docker exec spotify-homeserver supervisorctl restart desktop` |
| „verbinde…“, aber kein Ton | Spielt Spotify gerade? Im Firmennetz: Qualität *Kompatibel HLS* wählen. Status zeigt, ob die Encoder laufen. |
| Ton hakt | AAC 128 oder HLS wählen. Auf der Statusseite CPU prüfen (der Spotify-Client braucht etwa 1 Kern). |
| „Failed to connect to server“ im Bild | WebSocket blockiert: Seite neu laden, der Kompatibel-Modus greift automatisch. Hinter einem Reverse Proxy den Header *WebSocket* prüfen. |
| Login auf 8443 klappt nicht | Docker: `WEB_PASSWORD` in `.env` ändern, dann `docker compose up -d`. LXC: `WEB_PASSWORD=neu ./scripts/install-lxc.sh`. |
| Seite von außen nicht erreichbar | Portfreigabe im Router, DynDNS-Adresse, beim Reverse Proxy Ziel HTTPS:8443. Im Firmennetz ggf. DNS-Sperre. |
| Spotify zeigt Gerät nicht in Connect | Spotify einmal im Fenster öffnen und abspielen. Der Gerätename ist der Hostname. |

Logs:
- **Docker:** `docker compose logs -f`
- **LXC:** `journalctl -u spotify-desktop -u spotify-player-web -u 'spotify-enc@*' -f`

---

## Ports, Dateien, Sicherheit

| Port | Dienst | Login |
|---|---|---|
| **8443** | alles über HTTPS (Weboberfläche, Ton, Bild) | **ja**, nur diesen nach außen freigeben |
| 8080 | Weboberfläche | nein, nur Heimnetz |
| 8000 | Icecast-Streams | nein, nur Heimnetz |
| 6080 | noVNC | VNC-Passwort, nur Heimnetz |

**Nicht im Repository (Geheimnisse):**
- Passwörter und der Login-Hash (`/home/spotify/.weblogin.json`)
- Sitzungen
- die Spotify-Anmeldung und das Spotify-Profil
- die Spotify-API-Token
- der TLS-Schlüssel

Platzhalter heißen `CHANGE_ME`. `.env` und `*.pem` stehen in `.gitignore`.

Jeder Commit wird von GitHub Actions automatisch geprüft (`.github/workflows/docker.yml`). Der Test baut das Image, startet es und prüft:
- Dienste
- Ton
- HLS
- Bild-Modus
- Login
- Neustart
