import subprocess, json, os, re, shutil, time, urllib.request
os.environ.setdefault('XDG_RUNTIME_DIR', '/tmp/xdg-spotify')
SVCS = ['spotify-desktop', 'spotify-enc@aac128', 'icecast2', 'spotify-player-web', 'caddy']
NAMES = {'spotify-desktop': 'Spotify-Client', 'spotify-enc@aac128': 'Ton-Stream AAC 128 (immer an)', 'icecast2': 'Icecast',
         'spotify-player-web': 'Weboberfläche', 'caddy': 'Zugang von außen (8443)'}
def sh(*a, t=8):
    try:
        p = subprocess.run(list(a), capture_output=True, text=True, timeout=t); return p.returncode, p.stdout.strip()
    except Exception: return 1, ''
def sink_input():
    _, o = sh('pactl', 'list', 'sink-inputs')
    for block in o.split('Sink Input #')[1:]:
        if 'spotify' in block.lower():
            idx = block.split()[0]
            m = re.search(r'Volume:[^\n]*?(\d+)%', block)
            return idx, (int(m.group(1)) if m else None)
    return None, None
def meminfo():
    d = {}
    for l in open('/proc/meminfo'):
        k, v = l.split(':'); d[k] = int(v.split()[0])
    return d

def _ticks():
    out = {}
    for pid in os.listdir('/proc'):
        if not pid.isdigit(): continue
        try:
            st = open('/proc/%s/stat' % pid).read()
            comm = st[st.index('(') + 1:st.rindex(')')]; f = st[st.rindex(')') + 2:].split()
            out[pid] = (comm, int(f[11]) + int(f[12]))
        except Exception: pass
    return out
def cpu():
    a = _ticks(); time.sleep(0.5); b = _ticks(); hz = os.sysconf('SC_CLK_TCK')
    tot = spo = ff = 0.0
    for pid, (c, t) in b.items():
        if pid not in a: continue
        d = (t - a[pid][1]) / hz / 0.5 * 100
        tot += d
        if c == 'spotify': spo += d
        if c == 'ffmpeg': ff += d
    return round(tot), round(spo), round(ff)
def health():
    svc = []
    for s in SVCS:
        _, st = sh('systemctl', 'is-active', s)
        _, since = sh('systemctl', 'show', s, '-p', 'ActiveEnterTimestamp', '--value')
        svc.append({'id': s, 'name': NAMES[s], 'state': st, 'since': since})
    mounts = []
    try:
        with urllib.request.urlopen('http://127.0.0.1:8000/status-json.xsl', timeout=3) as r:
            src = json.load(r)['icestats'].get('source', [])
        if isinstance(src, dict): src = [src]
        for x in src:
            mounts.append({'mount': x.get('listenurl', '').rsplit('/', 1)[-1], 'type': x.get('server_type'), 'listeners': x.get('listeners', 0)})
    except Exception: pass
    m = meminfo(); du = shutil.disk_usage('/')
    load = open('/proc/loadavg').read().split()[:3]
    up = float(open('/proc/uptime').read().split()[0])
    ctot, spcpu, ffcpu = cpu()
    return {'services': sorted(mounts and svc or svc, key=lambda x: SVCS.index(x['id'])), 'mounts': mounts,
            'load': load, 'cpus': os.cpu_count(), 'mem_total': m.get('MemTotal', 0) * 1024,
            'mem_used': (m.get('MemTotal', 0) - m.get('MemAvailable', 0)) * 1024,
            'disk_total': du.total, 'disk_used': du.used, 'uptime': up,
            'cpu_ffmpeg': ffcpu, 'cpu_spotify': spcpu, 'cpu_total': ctot}
def get(path):
    if path == '/api/health': return health(), 200
    if path == '/api/volume':
        idx, v = sink_input(); return ({'volume': v} if idx else {'volume': None}), 200
    return None
def post(path, body):
    if path == '/api/volume':
        try: v = max(0, min(150, int(body.get('volume'))))
        except Exception: return {'ok': False}, 400
        idx, _ = sink_input()
        if not idx: return {'ok': False, 'error': 'Spotify spielt gerade nicht'}, 409
        rc, _ = sh('pactl', 'set-sink-input-volume', idx, '%d%%' % v); return {'ok': rc == 0, 'volume': v}, 200
    if path == '/api/restart':
        s = body.get('service')
        if s not in SVCS: return {'ok': False}, 400
        subprocess.Popen(['sh', '-c', 'sleep 1; sudo -n /usr/bin/systemctl restart ' + s], start_new_session=True,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {'ok': True}, 200
    return None
