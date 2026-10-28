(function(){
const s=document.getElementById('svol'), l=document.getElementById('svoll');
let t=null, busy=false;
function load(){ if(busy) return; fetch('/api/volume',{cache:'no-store'}).then(r=>r.json()).then(d=>{ if(d.volume!=null){ s.value=d.volume; l.textContent=d.volume+'%'; s.disabled=false } else { l.textContent='–'; } }).catch(()=>{}) }
s.addEventListener('input',()=>{ busy=true; l.textContent=s.value+'%'; clearTimeout(t); t=setTimeout(()=>{ fetch('/api/volume',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({volume:+s.value})}).finally(()=>{busy=false}) },150) });
load(); setInterval(load,5000);
})();
