import json, os, time, hashlib, hmac, secrets, threading
CRED = '/home/spotify/.weblogin.json'
SESS = '/home/spotify/.websessions.json'
MAXAGE = 30 * 86400
_lock = threading.Lock()
def _load(p, d):
    try:
        with open(p) as f: return json.load(f)
    except Exception: return d
def _save(p, o):
    with open(p + '.tmp', 'w') as f: json.dump(o, f)
    os.chmod(p + '.tmp', 0o600); os.replace(p + '.tmp', p)
def check_login(user, pw):
    c = _load(CRED, {})
    if not c: return False
    h = hashlib.pbkdf2_hmac('sha256', pw.encode(), bytes.fromhex(c['salt']), 200000).hex()
    return hmac.compare_digest(user, c.get('user', '')) & hmac.compare_digest(h, c.get('hash', ''))
def new_session():
    t = secrets.token_urlsafe(32)
    with _lock:
        s = {k: v for k, v in _load(SESS, {}).items() if v > time.time()}
        s[t] = time.time() + MAXAGE; _save(SESS, s)
    return t
def valid(cookie_header):
    tok = ''
    for part in (cookie_header or '').split(';'):
        k, _, v = part.strip().partition('=')
        if k == 'sr_session': tok = v
    if not tok: return False
    return _load(SESS, {}).get(tok, 0) > time.time()
