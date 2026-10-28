# Dienste steuern: systemd (Proxmox LXC / VM) oder supervisord (Docker)
# Auswahl ueber die Umgebungsvariable SERVICE_MANAGER=systemd|supervisor
import os, re, subprocess

MODE = os.environ.get('SERVICE_MANAGER', 'systemd')

# systemd-Name -> supervisord-Programmname
_SUP = {'spotify-desktop': 'desktop', 'icecast2': 'icecast', 'spotify-player-web': 'web', 'caddy': 'caddy'}


def _sup_name(name):
    if name in _SUP:
        return _SUP[name]
    if name.startswith('spotify-enc@'):
        return 'enc_' + name.split('@', 1)[1]
    return name


def _run(cmd):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=8)
        return p.returncode, p.stdout.strip()
    except Exception:
        return 1, ''


def is_active(name):
    if MODE == 'supervisor':
        _, out = _run(['supervisorctl', 'status', _sup_name(name)])
        return ' RUNNING ' in (' ' + out + ' ')
    _, out = _run(['systemctl', 'is-active', name])
    return out == 'active'


def since(name):
    if MODE == 'supervisor':
        _, out = _run(['supervisorctl', 'status', _sup_name(name)])
        m = re.search(r'uptime\s+(\S+)', out)
        return ('Laufzeit ' + m.group(1)) if m else ''
    _, out = _run(['systemctl', 'show', name, '-p', 'ActiveEnterTimestamp', '--value'])
    return out


def control(action, name, delay=0):
    """start | stop | restart, laeuft im Hintergrund (auch fuer den eigenen Dienst)."""
    if action not in ('start', 'stop', 'restart'):
        raise ValueError(action)
    if MODE == 'supervisor':
        cmd = 'supervisorctl %s %s' % (action, _sup_name(name))
    else:
        cmd = 'sudo -n /usr/bin/systemctl %s %s' % (action, name)
    if delay:
        cmd = 'sleep %d; %s' % (delay, cmd)
    subprocess.Popen(['sh', '-c', cmd], start_new_session=True,
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
