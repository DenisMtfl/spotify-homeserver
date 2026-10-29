# Bild ohne WebSocket: fuer Netze, deren Proxy noVNC (WebSocket) blockiert.
# Ein ffmpeg-Grabber laeuft nur bei Bedarf und liefert JPEG-Bilder des Spotify-Bildschirms (:1);
# Maus und Tastatur gehen per xdotool. Nach 20 s ohne Abruf wird der Grabber beendet.
import os, re, subprocess, threading, time

DISPLAY = ':1'
FPS = 4
IDLE = 20
_lock = threading.Condition()
_frame, _seq, _last, _proc = None, 0, 0.0, None


def _size():
    try:
        out = subprocess.run(['xdotool', 'getdisplaygeometry'], capture_output=True, text=True, timeout=3,
                             env=dict(os.environ, DISPLAY=DISPLAY)).stdout.split()
        return int(out[0]), int(out[1])
    except Exception:
        return 1280, 800


def _reader(p):
    global _frame, _seq
    buf = b''
    while True:
        chunk = p.stdout.read(65536)
        if not chunk:
            break
        buf += chunk
        while True:
            s = buf.find(b'\xff\xd8')
            e = buf.find(b'\xff\xd9', s + 2) if s >= 0 else -1
            if s < 0 or e < 0:
                if s > 0:
                    buf = buf[s:]
                break
            with _lock:
                _frame, _seq = buf[s:e + 2], _seq + 1
                _lock.notify_all()
            buf = buf[e + 2:]


def _watchdog():
    global _proc
    while True:
        time.sleep(5)
        with _lock:
            if _proc and time.time() - _last > IDLE:
                _proc.terminate()
                _proc = None
                return


def _ensure():
    global _proc
    if _proc and _proc.poll() is None:
        return
    w, h = _size()
    _proc = subprocess.Popen(
        ['ffmpeg', '-loglevel', 'error', '-f', 'x11grab', '-draw_mouse', '1', '-framerate', str(FPS),
         '-video_size', '%dx%d' % (w, h), '-i', DISPLAY, '-q:v', '7', '-f', 'mjpeg', '-'],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, start_new_session=True)
    threading.Thread(target=_reader, args=(_proc,), daemon=True).start()
    threading.Thread(target=_watchdog, daemon=True).start()


def frame(after=0, wait=2.0):
    """Naechstes Bild mit Nummer > after (wartet bis zu `wait` Sekunden)."""
    global _last
    with _lock:
        _last = time.time()
        _ensure()
        end = time.time() + wait
        while (_frame is None or _seq <= after) and time.time() < end:
            _lock.wait(end - time.time())
        return _seq, _frame


def _xdo(*args):
    subprocess.run(['xdotool'] + [str(a) for a in args], capture_output=True, timeout=5,
                   env=dict(os.environ, DISPLAY=DISPLAY))


_KEY = re.compile(r'^[A-Za-z0-9_+]{1,40}$')


def control(d):
    """Maus/Tastatur: {t: move|click|down|up|scroll|key|text, x, y, b, dy, k, s}"""
    t = d.get('t')
    x, y = int(d.get('x', 0)), int(d.get('y', 0))
    b = int(d.get('b', 1)) if int(d.get('b', 1)) in (1, 2, 3) else 1
    if t == 'move':
        _xdo('mousemove', x, y)
    elif t in ('click', 'dbl'):
        _xdo('mousemove', x, y, 'click', '--repeat', 2 if t == 'dbl' else 1, b)
    elif t == 'down':
        _xdo('mousemove', x, y, 'mousedown', b)
    elif t == 'up':
        _xdo('mousemove', x, y, 'mouseup', b)
    elif t == 'scroll':
        n = max(1, min(10, abs(int(d.get('dy', 1)))))
        _xdo('mousemove', x, y, 'click', '--repeat', n, 4 if int(d.get('dy', 1)) < 0 else 5)
    elif t == 'key':
        k = str(d.get('k', ''))
        if not _KEY.match(k):
            return False
        _xdo('key', '--clearmodifiers', k)
    elif t == 'text':
        s = str(d.get('s', ''))[:500]
        if s:
            _xdo('type', '--delay', 15, '--', s)
    else:
        return False
    return True
