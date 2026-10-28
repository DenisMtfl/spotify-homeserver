(function(){
const sel=document.getElementById('dev'), info=document.getElementById('devinfo');
let busy=false;
function load(){
  if(busy) return;
  fetch('/api/devices',{cache:'no-store'}).then(r=>r.json().then(d=>({c:r.status,d}))).then(({c,d})=>{
    if(c===401 || d.setup){ sel.style.display='none'; info.innerHTML='<a href="/setup.html" style="color:#1db954">Geräteauswahl einrichten</a>'; return }
    if(!d.devices){ info.textContent='Geräte nicht abrufbar'; return }
    sel.style.display=''; info.textContent='';
    const cur=sel.value; sel.innerHTML='';
    if(!d.devices.length){ const o=document.createElement('option'); o.textContent='kein Gerät online'; o.value=''; sel.appendChild(o) }
    d.devices.forEach(x=>{ const o=document.createElement('option'); o.value=x.id; o.textContent=(x.active?'▶ ':'')+x.name+' ('+x.type+')'; if(x.active) o.selected=true; sel.appendChild(o) });
  }).catch(()=>{ info.textContent='' });
}
sel.onfocus=()=>{busy=true}; sel.onblur=()=>{busy=false};
sel.onchange=()=>{
  busy=false; if(!sel.value) return; info.textContent='wechsle...';
  fetch('/api/transfer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:sel.value})})
    .then(r=>r.json()).then(d=>{ info.textContent=d.ok?'':'Wechsel fehlgeschlagen'; setTimeout(load,1500) });
};
load(); setInterval(load,10000);
})();
