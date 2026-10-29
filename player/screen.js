(function(){
/* Bild ohne WebSocket: Firmen-Proxys blockieren oft WebSockets, dann kann noVNC nicht verbinden.
   Ueber 8443/Reverse-Proxy wird zuerst ein WebSocket getestet; klappt das nicht, holt die Seite
   Bilder per normaler HTTPS-Anfrage (/api/screen) und schickt Maus/Tastatur per POST (/api/input). */
const PXmode = location.port!=="8080";
const rl=document.getElementById('rl');
const wrap=document.createElement('div');
wrap.id='scrwrap'; wrap.tabIndex=0;
wrap.style.cssText='flex:1;position:relative;background:#000;display:none;min-height:45vh;outline:none;touch-action:none;overflow:hidden';
const img=document.createElement('img');
img.draggable=false; img.alt='';
img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;user-select:none;-webkit-user-select:none';
const bar=document.createElement('div');
bar.style.cssText='position:absolute;right:8px;bottom:6px;display:flex;gap:6px;align-items:center;font-size:11px;color:#9aa0a6';
const badge=document.createElement('span'); badge.textContent='Kompatibel-Modus (ohne WebSocket)';
badge.style.cssText='background:rgba(0,0,0,.6);padding:2px 6px;border-radius:4px';
const kb=document.createElement('button'); kb.className='sec'; kb.textContent='Tastatur'; kb.style.cssText='padding:3px 10px;font-size:11px';
const inp=document.createElement('input'); inp.type='text'; inp.autocomplete='off'; inp.setAttribute('autocapitalize','off');
inp.style.cssText='position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
bar.append(badge,kb); wrap.append(img,bar,inp);
vnc.after(wrap);

let compat=false, seq=0, run=0, url=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const visible=()=>get('vis','1')==='1' && document.visibilityState==='visible';

async function loop(id){
  while(compat && run===id){
    if(!visible()){ await sleep(800); continue }
    try{
      const r=await fetch('/api/screen?after='+seq,{cache:'no-store'});
      if(r.status===401){ location.href='/login.html'; return }
      if(!r.ok){ await sleep(1500); continue }
      seq=+(r.headers.get('X-Frame')||seq);
      const u=URL.createObjectURL(await r.blob());
      img.src=u; if(url) URL.revokeObjectURL(url); url=u;
    }catch(e){ await sleep(2000) }
  }
}

/* Eingaben in fester Reihenfolge senden */
let q=Promise.resolve();
function send(d){ q=q.then(()=>fetch('/api/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).catch(()=>{})); return q }
function pos(e){
  const r=img.getBoundingClientRect(), W=img.naturalWidth||1280, H=img.naturalHeight||800;
  const s=Math.min(r.width/W, r.height/H), ox=r.left+(r.width-W*s)/2, oy=r.top+(r.height-H*s)/2;
  return {x:Math.max(0,Math.min(W-1,Math.round((e.clientX-ox)/s))), y:Math.max(0,Math.min(H-1,Math.round((e.clientY-oy)/s)))};
}
let p0=null, btn=1;
wrap.addEventListener('contextmenu',e=>e.preventDefault());
wrap.addEventListener('pointerdown',e=>{ if(e.target===kb) return; e.preventDefault(); wrap.focus({preventScroll:true}); p0=pos(e); btn=[1,2,3][e.button]||1 });
wrap.addEventListener('pointerup',e=>{
  if(!p0) return; const p=pos(e);
  if(Math.abs(p.x-p0.x)+Math.abs(p.y-p0.y)<8) send({t:'click',x:p0.x,y:p0.y,b:btn});
  else { send({t:'down',x:p0.x,y:p0.y,b:btn}); send({t:'up',x:p.x,y:p.y,b:btn}) }
  p0=null; seq=0;
});
let wt=0;
wrap.addEventListener('wheel',e=>{ e.preventDefault(); const now=Date.now(); if(now-wt<120) return; wt=now; const p=pos(e); send({t:'scroll',x:p.x,y:p.y,dy:e.deltaY<0?-2:2}) },{passive:false});

/* Tastatur */
const SPECIAL={Enter:'Return',Backspace:'BackSpace',Tab:'Tab',Escape:'Escape',ArrowLeft:'Left',ArrowRight:'Right',ArrowUp:'Up',ArrowDown:'Down',Delete:'Delete',Home:'Home',End:'End',PageUp:'Prior',PageDown:'Next'};
let buf='', bt=null;
function flush(){ if(buf){ send({t:'text',s:buf}); buf='' } }
function onKey(e){
  if(!compat) return;
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='v') return; // paste-Event uebernimmt
  let k=null;
  if(SPECIAL[e.key]) k=SPECIAL[e.key];
  else if((e.ctrlKey||e.altKey) && /^[a-z0-9]$/i.test(e.key)) k=(e.ctrlKey?'ctrl+':'')+(e.altKey?'alt+':'')+e.key.toLowerCase();
  if(k){ e.preventDefault(); flush(); send({t:'key',k}); return }
  if(e.key.length===1 && !e.ctrlKey && !e.metaKey){ e.preventDefault(); buf+=e.key; clearTimeout(bt); bt=setTimeout(flush,120) }
}
wrap.addEventListener('keydown',onKey);
wrap.addEventListener('paste',e=>{ const t=(e.clipboardData||window.clipboardData).getData('text'); if(t){ e.preventDefault(); flush(); send({t:'text',s:t}) } });
/* Handy: unsichtbares Eingabefeld fuer die Bildschirmtastatur */
kb.addEventListener('click',e=>{ e.stopPropagation(); inp.focus() });
inp.addEventListener('keydown',e=>{ if(SPECIAL[e.key]){ e.preventDefault(); send({t:'key',k:SPECIAL[e.key]}) } });
inp.addEventListener('input',()=>{ if(inp.value){ send({t:'text',s:inp.value}); inp.value='' } });

window.scrShow=function(on){ wrap.style.display=on?'':'none' };
function setCompat(on){
  compat=on; window.scrCompat=on; run++;
  if(window.viewApply) window.viewApply();
  if(on){ seq=0; loop(run) }
}

/* Testet, ob ein WebSocket zum Server durchkommt */
function probe(){
  return new Promise(res=>{
    let ws, done=false;
    const fin=v=>{ if(done) return; done=true; try{ ws&&ws.close() }catch(e){} res(v) };
    try{ ws=new WebSocket(location.origin.replace(/^http/,'ws')+'/websockify',['binary']) }catch(e){ return fin(false) }
    ws.onopen=()=>fin(true); ws.onerror=()=>fin(false); ws.onclose=()=>fin(false);
    setTimeout(()=>fin(false),6000);
  });
}
async function check(){
  if(!PXmode) return;           // im LAN (8080) immer noVNC
  if(get('scrforce','')==='1'){ setCompat(true); return }
  setCompat(!(await probe()));
}
rl.onclick=()=>{ if(compat){ setCompat(false); check() } else { vnc.src=vurl; check() } };
check();
})();
