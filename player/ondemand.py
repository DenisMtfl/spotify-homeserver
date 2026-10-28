# Startet Encoder bei Bedarf und stoppt sie nach Leerlauf
import threading, time, json, urllib.request
import svc as svcm
ALWAYS = 'aac128'
ONDEMAND = ['stream', 'stream192', 'stream128', 'aac192', 'aac256']
IDLE = 90  # Sekunden ohne Hoerer und ohne Anfrage
_last = {}
def _sys(action, m):
    svcm.control(action, 'spotify-enc@' + m)
def _active(m):
    return svcm.is_active('spotify-enc@' + m)
def _listeners():
    try:
        with urllib.request.urlopen('http://127.0.0.1:8000/status-json.xsl', timeout=3) as r:
            src = json.load(r)['icestats'].get('source', [])
        if isinstance(src, dict): src = [src]
        return {x.get('listenurl', '').rsplit('/', 1)[-1]: x.get('listeners', 0) for x in src}
    except Exception:
        return {}
def want(m):
    if m == ALWAYS: return True
    if m not in ONDEMAND: return False
    _last[m] = time.time()
    if not _active(m): _sys('start', m)
    return True
def _loop():
    while True:
        time.sleep(20)
        try:
            ls = _listeners()
            for m in ONDEMAND:
                if ls.get(m, 0) > 0: _last[m] = time.time(); continue
                if _active(m) and time.time() - _last.get(m, 0) > IDLE: _sys('stop', m)
        except Exception: pass
threading.Thread(target=_loop, daemon=True).start()
