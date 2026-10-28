(function(){
const now=document.getElementById('now');
function cmd(c){ fetch('/api/'+c,{method:'POST'}).then(()=>setTimeout(poll,700)).catch(()=>{}) }
document.getElementById('bprev').onclick=()=>cmd('prev');
document.getElementById('bplay').onclick=()=>cmd('play');
document.getElementById('bnext').onclick=()=>cmd('next');
function poll(){ fetch('/api/now',{cache:'no-store'}).then(r=>r.json()).then(d=>{ now.textContent = d.playing ? '♫ '+d.title : 'Spotify pausiert' }).catch(()=>{}) }
poll(); setInterval(poll,3000);
})();
