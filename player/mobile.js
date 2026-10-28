(function(){
const mq=window.matchMedia('(max-width: 760px)');
// Bild auf dem Handy standardmaessig aus (nur beim ersten Besuch)
if(mq.matches){ try{ if(localStorage.getItem('vis')===null) localStorage.setItem('vis','0') }catch(e){} }
const css=`
body:not(.m) #hero, body:not(.m) #mset{display:none}
body.m header{display:block;padding:0;border:0;background:transparent!important}
body.m header h1{display:none}
body.m{background:linear-gradient(180deg,var(--tint,#0f1115) 0%,#0f1115 70%);min-height:100vh}
body:not(.m) header{background:linear-gradient(90deg,var(--tinta,#181b22) 0%,#181b22 55%)}
body.m #hero{display:flex;flex-direction:column;align-items:center;gap:14px;padding:20px 16px 6px}
body.m #cover{width:min(72vw,320px)!important;height:min(72vw,320px)!important;border-radius:12px!important;box-shadow:0 10px 30px rgba(0,0,0,.55);display:block!important}
body.m #now{max-width:90vw!important;font-size:17px;font-weight:600;text-align:center;white-space:normal!important;line-height:1.35}
body.m .progw{width:min(90vw,420px);padding:0!important;background:transparent!important}
body.m .ctl{display:flex;gap:18px;align-items:center;justify-content:center}
body.m .ctl button{width:58px;height:58px;border-radius:50%;font-size:22px;padding:0}
body.m #bplay{width:72px!important;height:72px!important;font-size:28px!important;background:#1db954!important;color:#000!important}
body.m #pl{width:min(82vw,340px);padding:13px;font-size:16px}
body.m .info{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:12px;color:#9aa0a6}
body.m #mset{margin:10px 16px 14px;background:#181b22;border:1px solid #262a33;border-radius:12px;padding:4px 14px}
body.m #mset summary{padding:10px 0;cursor:pointer;font-weight:600}
body.m #mset label{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #262a33}
body.m #mset input[type=range]{width:52vw}
body.m #mset select{max-width:58vw;font-size:15px;padding:7px}
body.m #mset .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:10px 0;border-top:1px solid #262a33}
body.m iframe{min-height:62vh}
@media (max-height: 560px), (max-width: 360px){
body.m #hero{display:grid;grid-template-columns:64px 1fr;gap:6px 12px;padding:10px 12px 4px;align-items:center;justify-items:stretch}
body.m #cover{width:64px!important;height:64px!important;grid-row:1/3;border-radius:8px!important;box-shadow:none}
body.m #now{font-size:14px;text-align:left;max-width:none!important;white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis}
body.m .progw{grid-column:2;width:auto}
body.m .ctl{grid-column:1/3;gap:10px}
body.m .ctl button{width:40px;height:40px;font-size:16px}
body.m #bplay{width:46px!important;height:46px!important;font-size:18px!important}
body.m #pl{grid-column:1/3;width:auto;padding:7px;font-size:14px}
body.m .info{grid-column:1/3;flex-direction:row;gap:10px;justify-content:center;flex-wrap:wrap;font-size:11px}
body.m #mset{margin:6px 12px 8px;padding:2px 12px}
body.m #mset summary{padding:6px 0;font-size:13px}
body.m #mset label,body.m #mset .row{padding:6px 0}
body.m #mset input[type=range]{width:45vw}
body.m iframe{min-height:45vh}
}
`;
const stl=document.createElement('style'); stl.textContent=css; document.head.appendChild(stl);
const $=id=>document.getElementById(id), lab=id=>{const e=$(id); return e?e.closest('label'):null};
const header=document.querySelector('header'), prog=header.nextElementSibling; prog.classList.add('progw');
// Container einmalig anlegen
const hero=document.createElement('div'); hero.id='hero';
const ctl=document.createElement('div'); ctl.className='ctl';
const info=document.createElement('div'); info.className='info';
const det=document.createElement('details'); det.id='mset';
const sum=document.createElement('summary'); sum.textContent='Einstellungen'; det.appendChild(sum);
const row=document.createElement('div'); row.className='row';
header.appendChild(hero); header.appendChild(det);
// [Element, Ziel] - Ziel ist der Container in der Handy-Ansicht
const plan=[[$('cover'),hero],[$('now'),hero],[prog,hero],[$('bprev'),ctl],[$('bplay'),ctl],[$('bnext'),ctl],[ctl,hero],[$('pl'),hero],
  [$('st'),info],[$('lat'),info],[$('mb'),info],[info,hero],
  [lab('vol'),det],[lab('svol'),det],[lab('q'),det],[lab('dev'),det],
  [$('devinfo'),row],[document.querySelector('a[href="/status.html"]'),row],[$('tg'),row],[$('rl'),row],[row,det]].filter(p=>p[0]);
// Platzhalter merken die Originalposition (Desktop)
const home=new Map();
plan.forEach(([el])=>{ if(el.parentNode && el!==ctl && el!==info && el!==row){ const c=document.createComment('m'); el.parentNode.insertBefore(c,el); home.set(el,c) } });
function apply(m){
  if(m){ document.body.classList.add('m'); plan.forEach(([el,to])=>to.appendChild(el)) }
  else { document.body.classList.remove('m'); home.forEach((c,el)=>c.parentNode.insertBefore(el,c.nextSibling)) }
}
apply(mq.matches);
mq.addEventListener ? mq.addEventListener('change',e=>apply(e.matches)) : mq.addListener(e=>apply(e.matches));
})();
