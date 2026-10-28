(function(){
const cover=document.getElementById('cover'), bar=document.getElementById('progb'), tm=document.getElementById('tm');
let d={length:0,position:0,playing:false}, t0=Date.now(), lastArt='', lastKey='';
const ms='mediaSession' in navigator;
function fmt(x){x=Math.max(0,Math.floor(x));return Math.floor(x/60)+':'+String(x%60).padStart(2,'0')}
function api(c){return fetch('/api/'+c,{method:'POST'}).then(()=>setTimeout(poll,700)).catch(()=>{})}
if(ms){
  navigator.mediaSession.setActionHandler('play',()=>{ if(!d.playing) api('play') });
  navigator.mediaSession.setActionHandler('pause',()=>{ if(d.playing) api('play') });
  navigator.mediaSession.setActionHandler('previoustrack',()=>api('prev'));
  navigator.mediaSession.setActionHandler('nexttrack',()=>api('next'));
}
function poll(){
  fetch('/api/now',{cache:'no-store'}).then(r=>r.json()).then(x=>{
    d=x; t0=Date.now();
    if(x.art && x.art!==lastArt){ cover.src="/cover?u="+encodeURIComponent(x.art); lastArt=x.art }
    cover.style.display=x.art?'':'none';
    const key=(x.track||'')+'|'+(x.artist||'');
    if(ms && x.track && key!==lastKey){
      lastKey=key;
      navigator.mediaSession.metadata=new MediaMetadata({title:x.track,artist:x.artist||'',album:x.album||'',artwork:x.art?[{src:x.art,sizes:'640x640',type:'image/jpeg'}]:[]});
    }
    if(ms) navigator.mediaSession.playbackState=x.playing?'playing':'paused';
  }).catch(()=>{});
}
function tick(){
  if(!d.length){ bar.style.width='0'; tm.textContent=''; return }
  const p=Math.min(d.length, d.position + (d.playing?(Date.now()-t0)/1000:0));
  bar.style.width=(100*p/d.length)+'%'; tm.textContent=fmt(p)+' / '+fmt(d.length);
  if(ms && navigator.mediaSession.setPositionState){ try{navigator.mediaSession.setPositionState({duration:d.length,position:p,playbackRate:1})}catch(e){} }
}
poll(); setInterval(poll,2000); setInterval(tick,500);
})();
