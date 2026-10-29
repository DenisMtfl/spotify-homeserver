(function(){
const kb={stream128:128,stream192:192,stream:320,aac128:128,aac192:192,aac256:256,hls:128,hls96:96,hls64:64};
let ses=0, tot=+get('tot','0');
const mb=document.getElementById('mb');
function fmt(b){return b>=1e9?(b/1e9).toFixed(2)+' GB':(b/1e6).toFixed(1)+' MB'}
function show(){mb.textContent='Gestreamt: '+fmt(ses)+' (gesamt '+fmt(tot)+')'}
setInterval(function(){
  if(on && !au.paused && au.readyState>=3){const b=(kb[q.value]||192)*125; ses+=b; tot+=b; set('tot',tot); show()}
},1000);
mb.onclick=function(){ if(confirm('Gesamtzähler zurücksetzen?')){tot=0; set('tot',0); show()} };
show();
})();
