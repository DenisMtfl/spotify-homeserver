(function(){
const tg=document.getElementById('tg'), rl=document.getElementById('rl');
let vis=get('vis','1')==='1';
function apply(){
  if(vis){ vnc.style.display=''; if(vnc.getAttribute('src')!==vurl) vnc.src=vurl; tg.textContent='Bild aus'; rl.style.display='' }
  else { vnc.src='about:blank'; vnc.style.display='none'; tg.textContent='Bild an'; rl.style.display='none' }
  set('vis', vis?'1':'0');
}
tg.onclick=function(){ vis=!vis; apply() };
apply();
})();
