(function(){
const el=document.getElementById('lat');
const BASE=200, LIMIT=1500, CHECKS=6; // 6 x 500 ms = 3 s ueber Grenzwert
let over=0, jumps=0;
function live(){
  if(!on || !au.buffered.length) return false;
  const end=au.buffered.end(au.buffered.length-1);
  if(end-au.currentTime>0.6){ au.currentTime=end-0.4; return true }
  return false;
}
setInterval(function(){
  if(!on || au.paused || !au.buffered.length){ el.textContent=''; over=0; return }
  const ahead=(au.buffered.end(au.buffered.length-1)-au.currentTime)*1000;
  if(ahead<0){ el.textContent=''; return }
  const ms=Math.round(ahead+BASE);
  over = ms>LIMIT ? over+1 : 0;
  // auto-live deaktiviert
  el.textContent='Verzögerung ca. '+ms+' ms'+(jumps?' (auto-live '+jumps+'×)':'');
  el.style.color = ms<1500 ? '#1db954' : (ms<4000 ? '#e8b339' : '#e5534b');
},500);
el.onclick=function(){ live() };
})();
