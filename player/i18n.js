(function(){
const L=(navigator.languages&&navigator.languages[0])||navigator.language||'en';
if(/^de\b/i.test(L)) return;            // deutscher Browser: nichts aendern
document.documentElement.lang='en';
const M={
 'Ton an':'Sound on','▶ Ton an':'▶ Sound on','❚❚ Ton aus':'❚❚ Sound off','Ton aus':'Sound off',
 'verbinde...':'connecting...','Kompatibel-Modus (ohne WebSocket)':'Compatible mode (no WebSocket)','Tastatur':'Keyboard','Kompatibel HLS 128 kbit/s (Firmennetz)':'Compatible HLS 128 kbit/s (corporate network)','Kompatibel HLS 96 kbit/s':'Compatible HLS 96 kbit/s','Kompatibel HLS 64 kbit/s':'Compatible HLS 64 kbit/s','Verbindung weg, neuer Versuch...':'Connection lost, retrying...',
 'Qualität':'Quality','Lautstärke':'Volume','Gerät':'Device',
 'Geräteauswahl einrichten':'Set up device selection','Geräte nicht abrufbar':'Devices unavailable',
 'kein Gerät online':'no device online','wechsle...':'switching...','Wechsel fehlgeschlagen':'Switch failed',
 'Bild aus':'Hide screen','Bild an':'Show screen','Bild neu verbinden':'Reconnect screen',
 'Spotify pausiert':'Spotify paused','AAC 128 kbit/s (empfohlen)':'AAC 128 kbit/s (recommended)',
 'Vorheriger Titel':'Previous track','Nächster Titel':'Next track','Klick: auf Live springen':'Click: jump to live',
 'Klick: Gesamtzähler zurücksetzen':'Click: reset total counter',
 'Lautstärke in Spotify (wirkt für alle Hörer)':'Spotify volume (affects all listeners)',
 'Gesamtzähler zurücksetzen?':'Reset total counter?',
 'lade...':'loading...','Dienste':'Services','Dienst':'Service','läuft seit':'running since','Hörer':'Listeners',
 '← zurück zum Player':'← back to player','CPU Container':'CPU (container)','Arbeitsspeicher':'Memory',
 'Festplatte':'Disk','Laufzeit Container':'Container uptime','läuft':'running','Neu starten':'Restart',
 'keine Streams aktiv':'no active streams','Server nicht erreichbar':'Server unreachable',
 'Spotify-Client':'Spotify client','Ton-Stream (ffmpeg)':'Audio stream (ffmpeg)','Weboberfläche':'Web interface',
 'Zugang von außen (8443)':'External access (8443)',
 '1. Spotify-App anlegen (einmalig)':'1. Create a Spotify app (once)','2. Client ID hier eintragen':'2. Enter the Client ID here',
 '3. Einmal anmelden':'3. Log in once','Speichern':'Save','Anmeldung im Server-Fenster öffnen':'Open login in the server window',
 'gespeichert':'saved','verbunden ✓':'connected ✓','nicht eingerichtet':'not set up',
 'Client ID gespeichert, Anmeldung fehlt':'Client ID saved, login missing','← zurück zur Hauptseite':'← back to main page',
 'Falkon geöffnet – jetzt im Bild auf der Hauptseite anmelden':'Falkon opened – now log in via the screen on the main page',
 'Erst Client ID speichern':'Save the Client ID first','Client-ID ungueltig':'Invalid Client ID','Fehler':'Error','Einstellungen':'Settings','Benutzer':'User','Passwort':'Password','Anmelden':'Log in','Benutzer oder Passwort falsch':'Wrong user or password','Ton-Stream AAC 128 (immer an)':'Audio stream AAC 128 (always on)','Zum Starten auf Ton an tippen':'Tap Sound on to start'
};
const R=[
 [/^Verzögerung ca\. (\d+) ms(.*)$/,'Latency approx. $1 ms$2'],
 [/^Gestreamt: (.+) \(gesamt (.+)\)$/,'Streamed: $1 (total $2)'],
 [/^läuft \((.+)\)$/,'playing ($1)'],
 [/^aktualisiert (.+)$/,'updated $1'],
 [/^(\d+) % von (\d+) %$/,'$1 % of $2 %'],
 [/^(\d+) T (\d+) h (\d+) min$/,'$1 d $2 h $3 min'],
 [/^(.+) neu starten\?$/,'Restart $1?']
];
function tr(s){
  if(s==null) return null; const t=String(s).trim(); if(!t) return null;
  if(Object.prototype.hasOwnProperty.call(M,t)) return String(s).replace(t,M[t]);
  for(const [re,r] of R){ if(re.test(t)) return String(s).replace(t,t.replace(re,r)) }
  return null;
}
function walk(n){
  if(n.nodeType===3){ const x=tr(n.nodeValue); if(x!==null && x!==n.nodeValue) n.nodeValue=x; return }
  if(n.nodeType!==1 || n.tagName==='SCRIPT' || n.tagName==='STYLE') return;
  for(const a of ['title','placeholder','alt']){ if(n.hasAttribute(a)){ const x=tr(n.getAttribute(a)); if(x!==null) n.setAttribute(a,x) } }
  n.childNodes.forEach(walk);
}
walk(document.body); const dt=tr(document.title); if(dt) document.title=dt;
new MutationObserver(ms=>{ for(const m of ms){ if(m.type==='characterData') walk(m.target); else m.addedNodes.forEach(walk) } })
  .observe(document.body,{subtree:true,childList:true,characterData:true});
const oc=window.confirm.bind(window); window.confirm=function(msg){ const x=tr(msg); return oc(x===null?msg:x) };
})();
