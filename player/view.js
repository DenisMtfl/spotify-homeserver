(function(){
const tg=document.getElementById('tg'), rl=document.getElementById('rl');
let vis=get('vis','1')==='1';
function apply(){
  const c=!!window.scrCompat;
  if(vis){ if(c){ vnc.src='about:blank'; vnc.style.display='none' } else { vnc.style.display=''; if(vnc.getAttribute('src')!==vurl) vnc.src=vurl } tg.textContent='Bild aus'; rl.style.display='' }
  else { vnc.src='about:blank'; vnc.style.display='none'; tg.textContent='Bild an'; rl.style.display='none' }
  set('vis', vis?'1':'0');
  if(window.scrShow) window.scrShow(vis && c);
}
window.viewApply=apply;
tg.onclick=function(){ vis=!vis; apply() };
apply();
})();
