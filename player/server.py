import http.server, subprocess, json, os, functools, sys, urllib.parse
sys.path.insert(0, '/opt/player')
import spotify_api as sp
import ops
import webauth
import ondemand
import urllib.request
os.environ['DISPLAY'] = ':1'
os.environ.setdefault('DBUS_SESSION_BUS_ADDRESS', 'unix:path=/tmp/xdg-spotify/bus')
MPRIS = {'next': 'next', 'prev': 'previous', 'play': 'play-pause'}
KEYS = {'next': 'ctrl+Right', 'prev': 'ctrl+Left', 'play': 'space'}
def run(*a):
    try:
        p = subprocess.run(list(a), capture_output=True, text=True, timeout=5); return p.returncode, p.stdout.strip()
    except Exception: return 1, ''
def pc(*a): return run('playerctl', '-p', 'spotify', *a)
def main_window():
    best, area = None, 0
    for w in run('xdotool', 'search', '--onlyvisible', '--class', 'spotify')[1].split():
        g = run('xdotool', 'getwindowgeometry', w)[1]
        try: wh = g.split('Geometry:')[1].split()[0].split('x'); a = int(wh[0]) * int(wh[1])
        except Exception: a = 0
        if a > area: best, area = w, a
    return best
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        pth = self.path.split('?')[0]
        if pth == '/' or pth.endswith(('.html', '.js')): self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()
    def send_json(self, obj, code=200):
        b = json.dumps(obj).encode(); self.send_response(code)
        self.send_header('Content-Type', 'application/json'); self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def send_html(self, html, code=200):
        b = html.encode(); self.send_response(code); self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        try: return json.loads(self.rfile.read(n) or b'{}')
        except Exception: return {}
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == '/cover':
            src = q.get('u', [''])[0]
            if not src.startswith('https://i.scdn.co/image/'): return self.send_json({'error': 'bad'}, 400)
            try:
                with urllib.request.urlopen(src, timeout=8) as rr: data = rr.read(); ct = rr.headers.get('Content-Type', 'image/jpeg')
            except Exception: return self.send_json({'error': 'fetch'}, 502)
            self.send_response(200); self.send_header('Content-Type', ct); self.send_header('Cache-Control', 'max-age=86400')
            self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data); return
        if u.path.startswith('/hls/'):
            name = u.path[5:]
            if name == 'live.m3u8': ondemand.want('hls')
            if '/' in name or not (name == 'live.m3u8' or (name.startswith('seg') and name.endswith('.ts'))):
                return self.send_json({'error': 'bad'}, 404)
            try:
                with open('/tmp/hls/' + name, 'rb') as f: data = f.read()
            except OSError: return self.send_json({'error': 'missing'}, 404)
            self.send_response(200)
            self.send_header('Content-Type', 'application/vnd.apple.mpegurl' if name.endswith('.m3u8') else 'video/mp2t')
            self.send_header('Cache-Control', 'no-store' if name.endswith('.m3u8') else 'max-age=60')
            self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data); return
        if u.path == '/auth':
            if webauth.valid(self.headers.get('Cookie')): return self.send_json({'ok': True})
            self.send_response(302); self.send_header('Location', '/login.html'); self.send_header('Content-Length', '0'); self.end_headers(); return
        r = ops.get(u.path)
        if r is not None: return self.send_json(*r)
        if u.path == '/api/now':
            rc, status = pc('status')
            if rc == 0 and status:
                _, meta = pc('metadata', '--format', '{{artist}}|~|{{title}}|~|{{album}}|~|{{mpris:artUrl}}|~|{{mpris:length}}')
                f = (meta.split('|~|') + [''] * 5)[:5]
                _, pos = pc('position')
                art = f[3].replace('https://open.spotify.com/image/', 'https://i.scdn.co/image/')
                try: ln = int(f[4]) / 1e6
                except Exception: ln = 0
                try: ps = float(pos)
                except Exception: ps = 0
                title = (f[0] + ' - ' + f[1]) if f[0] else f[1]
                return self.send_json({'title': title, 'artist': f[0], 'track': f[1], 'album': f[2], 'art': art, 'length': ln, 'position': ps, 'playing': status == 'Playing', 'status': status, 'via': 'mpris'})
            w = main_window(); name = run('xdotool', 'getwindowname', w)[1] if w else ''
            playing = bool(name) and not name.lower().startswith('spotify')
            return self.send_json({'title': name if playing else '', 'playing': playing, 'via': 'window'})
        if u.path == '/api/apistatus': return self.send_json(sp.status())
        if u.path == '/api/devices':
            try: code, d = sp.api('GET', '/me/player/devices')
            except Exception as e: return self.send_json({'error': str(e)}, 502)
            if code != 200: return self.send_json(d, code)
            return self.send_json({'devices': [{'id': x['id'], 'name': x['name'], 'type': x['type'], 'active': x['is_active']} for x in d.get('devices', [])]})
        if u.path == '/login':
            url = sp.login_url()
            if not url: return self.send_html('<p>Erst Client-ID eintragen: <a href="/setup.html">Einrichtung</a></p>', 400)
            self.send_response(302); self.send_header('Location', url); self.end_headers(); return
        if u.path == '/callback':
            if 'error' in q: return self.send_html('<p>Spotify-Anmeldung abgebrochen: ' + q['error'][0] + '</p>')
            try: sp.callback(q.get('code', [''])[0], q.get('state', [''])[0])
            except Exception as e: return self.send_html('<p>Fehler: ' + str(e) + '</p>', 500)
            return self.send_html('<h2>Verbunden &#10003;</h2><p>Du kannst dieses Fenster schlie&szlig;en. Die Ger&auml;teauswahl ist jetzt aktiv.</p>')
        return super().do_GET()
    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == '/dologin':
            n = int(self.headers.get('Content-Length') or 0)
            f = urllib.parse.parse_qs(self.rfile.read(n).decode())
            if webauth.check_login(f.get('user', [''])[0].strip(), f.get('pass', [''])[0]):
                t = webauth.new_session(); self.send_response(303)
                self.send_header('Set-Cookie', 'sr_session=' + t + '; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax')
                self.send_header('Location', '/'); self.send_header('Content-Length', '0'); self.end_headers(); return
            import time; time.sleep(1.5)
            self.send_response(303); self.send_header('Location', '/login.html?fail=1'); self.send_header('Content-Length', '0'); self.end_headers(); return
        if u.path == '/api/want':
            ok = ondemand.want(str(self.body().get('mount', '')))
            return self.send_json({'ok': ok}, 200 if ok else 400)
        if u.path in ('/api/volume', '/api/restart'):
            r = ops.post(u.path, self.body())
            if r is not None: return self.send_json(*r)
        if u.path == '/api/config':
            cid = str(self.body().get('client_id', '')).strip()
            if not cid.isalnum() or len(cid) < 20: return self.send_json({'ok': False, 'error': 'Client-ID ungueltig'}, 400)
            sp.set_client(cid); return self.send_json({'ok': True})
        if u.path == '/api/openlogin':
            if not sp.status()['client_id']: return self.send_json({'ok': False, 'error': 'Erst Client ID speichern'}, 400)
            env = dict(os.environ, QTWEBENGINE_DISABLE_SANDBOX='1', QTWEBENGINE_CHROMIUM_FLAGS='--disable-gpu')
            subprocess.Popen(['falkon', 'http://127.0.0.1:8080/login'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            return self.send_json({'ok': True})
        if u.path == '/api/transfer':
            did = str(self.body().get('id', ''))
            try: code, d = sp.api('PUT', '/me/player', {'device_ids': [did], 'play': True})
            except Exception as e: return self.send_json({'error': str(e)}, 502)
            return self.send_json({'ok': code in (200, 202, 204), 'code': code, 'detail': d}, 200 if code in (200, 202, 204) else code)
        cmd = u.path.rsplit('/', 1)[-1]
        if not u.path.startswith('/api/') or cmd not in MPRIS: return self.send_json({'ok': False}, 404)
        rc, _ = pc(MPRIS[cmd])
        if rc == 0: return self.send_json({'ok': True, 'via': 'mpris'})
        w = main_window()
        if not w: return self.send_json({'ok': False, 'error': 'Spotify nicht erreichbar'}, 503)
        run('xdotool', 'windowactivate', '--sync', w, 'key', '--clearmodifiers', KEYS[cmd])
        return self.send_json({'ok': True, 'via': 'keys'})
http.server.ThreadingHTTPServer(('', 8080), functools.partial(H, directory='/opt/player')).serve_forever()
