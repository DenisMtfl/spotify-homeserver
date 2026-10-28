import json, os, time, base64, hashlib, secrets, urllib.request, urllib.parse
CFG = '/home/spotify/.spotify_api.json'
REDIRECT = 'http://127.0.0.1:8080/callback'
SCOPES = 'user-read-playback-state user-modify-playback-state'
_pending = {}
def load():
    try:
        with open(CFG) as f: return json.load(f)
    except Exception: return {}
def save(c):
    with open(CFG + '.tmp', 'w') as f: json.dump(c, f)
    os.chmod(CFG + '.tmp', 0o600); os.replace(CFG + '.tmp', CFG)
def set_client(cid):
    c = load(); c['client_id'] = cid.strip(); c.pop('refresh_token', None); c.pop('access_token', None); save(c)
def login_url():
    c = load(); cid = c.get('client_id')
    if not cid: return None
    ver = secrets.token_urlsafe(64)[:96]; state = secrets.token_urlsafe(16)
    chal = base64.urlsafe_b64encode(hashlib.sha256(ver.encode()).digest()).decode().rstrip('=')
    _pending[state] = ver
    q = {'client_id': cid, 'response_type': 'code', 'redirect_uri': REDIRECT, 'scope': SCOPES,
         'code_challenge_method': 'S256', 'code_challenge': chal, 'state': state}
    return 'https://accounts.spotify.com/authorize?' + urllib.parse.urlencode(q)
def _token(data):
    req = urllib.request.Request('https://accounts.spotify.com/api/token', data=urllib.parse.urlencode(data).encode(),
                                 headers={'Content-Type': 'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(req, timeout=10) as r: return json.load(r)
def callback(code, state):
    ver = _pending.pop(state, None)
    if not ver: raise Exception('Ungueltiger Status, bitte Anmeldung neu starten')
    c = load(); t = _token({'grant_type': 'authorization_code', 'code': code, 'redirect_uri': REDIRECT,
                            'client_id': c['client_id'], 'code_verifier': ver})
    c['access_token'] = t['access_token']; c['expires'] = time.time() + t.get('expires_in', 3600) - 60
    c['refresh_token'] = t.get('refresh_token', c.get('refresh_token')); save(c)
def access():
    c = load()
    if not c.get('refresh_token'): return None
    if c.get('access_token') and c.get('expires', 0) > time.time(): return c['access_token']
    t = _token({'grant_type': 'refresh_token', 'refresh_token': c['refresh_token'], 'client_id': c['client_id']})
    c['access_token'] = t['access_token']; c['expires'] = time.time() + t.get('expires_in', 3600) - 60
    if t.get('refresh_token'): c['refresh_token'] = t['refresh_token']
    save(c); return c['access_token']
def api(method, path, body=None):
    tok = access()
    if not tok: return 401, {'setup': True}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request('https://api.spotify.com/v1' + path, data=data, method=method,
                                 headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            raw = r.read(); return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b'{}')
        except Exception: return e.code, {}
def status():
    c = load(); return {'client_id': bool(c.get('client_id')), 'connected': bool(c.get('refresh_token'))}
