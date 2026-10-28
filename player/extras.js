(function(){
/* 3) Hintergrundfarbe passend zum Cover */
const cover=document.getElementById('cover'), header=document.querySelector('header');
const mobile=document.body.classList.contains('m');
cover.addEventListener('load',function(){
  try{
    const c=document.createElement('canvas'); c.width=c.height=24; const x=c.getContext('2d');
    x.drawImage(cover,0,0,24,24); const d=x.getImageData(0,0,24,24).data;
    let r=0,g=0,b=0,n=0;
    for(let i=0;i<d.length;i+=4){ const mx=Math.max(d[i],d[i+1],d[i+2]), mn=Math.min(d[i],d[i+1],d[i+2]);
      const w=1+(mx-mn)/40; r+=d[i]*w; g+=d[i+1]*w; b+=d[i+2]*w; n+=w }
    r/=n; g/=n; b/=n;
    const lum=(0.299*r+0.587*g+0.114*b)/255, k=lum>0.42?0.42/lum:1; r=Math.round(r*k); g=Math.round(g*k); b=Math.round(b*k);
    const col='rgb('+r+','+g+','+b+')';
    document.documentElement.style.setProperty('--tint',col); document.documentElement.style.setProperty('--tinta','rgba('+r+','+g+','+b+',.75)');
    const m=document.querySelector('meta[name=theme-color]')||document.head.appendChild(Object.assign(document.createElement('meta'),{name:'theme-color'}));
    m.content=col;
  }catch(e){}
});
/* 4) Bildschirm wach halten, solange Ton laeuft (nur ueber HTTPS moeglich) */
let lock=null;
async function wl(){
  const want = on && !au.paused && document.visibilityState==='visible';
  try{
    if(want && !lock && 'wakeLock' in navigator){ lock=await navigator.wakeLock.request('screen'); lock.addEventListener('release',()=>{lock=null}) }
    else if(!want && lock){ await lock.release(); lock=null }
  }catch(e){ lock=null }
}
['playing','pause','emptied'].forEach(ev=>au.addEventListener(ev,wl));
document.addEventListener('visibilitychange',wl); setInterval(wl,10000);
/* 7) Schnellstart: war der Ton beim letzten Mal an, direkt wieder starten */
pl.addEventListener('click',()=>setTimeout(()=>set('on',on?'1':'0'),0));
if(get('on','0')==='1'){
  pl.click();
  setTimeout(()=>{ if(on && au.paused){ stop(); st.textContent='Zum Starten auf Ton an tippen' } },4000);
}
})();
