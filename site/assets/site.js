(function(){
'use strict';
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const smoothstep=(p,e0,e1)=>{const t=clamp((p-e0)/(e1-e0),0,1);return t*t*(3-2*t)};
const $=s=>document.querySelector(s);
const hero=$('.hero'),stage=$('#stage'),video=$('#heroVideo'),ring=$('.ring'),altEl=$('#alt'),cue=$('#cue'),nav=$('.nav');
const RM=matchMedia('(prefers-reduced-motion: reduce)');
const EN=document.documentElement.lang==='en',BASE=document.documentElement.dataset.base||'';
// rutas absolutas: una url() dentro de una variable CSS se resuelve contra la hoja de estilos, no contra la página
const asset=n=>new URL(BASE+'assets/'+n,document.baseURI).href;

/* ---------- pantalla de carga ---------- */
const loader=$('#loader');
let ldTarget=0,ldShown=0,revealed=!loader;const revealCbs=[];
function onReveal(cb){revealed?cb():revealCbs.push(cb)}
function setLoad(f){ldTarget=Math.max(ldTarget,f)}
function reveal(){
  if(revealed)return;revealed=true;
  document.documentElement.classList.remove('ld');
  loader.classList.add('out');
  setTimeout(()=>loader.remove(),900);
  revealCbs.forEach(f=>f());
}
if(loader){
  if(RM.matches||!document.documentElement.classList.contains('ld'))reveal();
  else{
    const ringEl=loader.querySelector('.ld-ring'),altL=loader.querySelector('.ld-alt'),msgEl=loader.querySelector('.ld-msg');
    const msgs=loader.dataset.msgs.split('|'),t0=performance.now();
    let mi=-1,lastA='',lastP=-1;
    (function loop(now){
      const cap=Math.min(ldTarget,(now-t0)/1600);      // nunca más rápido que 1.6 s
      ldShown+=(cap-ldShown)*.14;
      if(cap>=1&&ldShown>.992)ldShown=1;
      ringEl.style.strokeDashoffset=(289*(1-ldShown)).toFixed(1);
      const p=+ldShown.toFixed(2);
      if(p!==lastP){lastP=p;loader.style.setProperty('--p',p)}
      const m=Math.round(12000*(1-ldShown)/100)*100;
      const a=m>0?(EN?'Altitude '+m.toLocaleString('en-US')+' m':'Altitud '+m.toLocaleString('en-US').replace(/,/g,' ')+' m'):(EN?'0 m · Landed':'0 m · En tierra');
      if(a!==lastA){lastA=a;altL.textContent=a}
      const i=Math.min(msgs.length-1,Math.floor(ldShown*msgs.length));
      if(i!==mi){mi=i;msgEl.textContent=msgs[i];if(msgEl.animate)msgEl.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:320,easing:'ease-out'})}
      if(ldShown>=1){setTimeout(reveal,380);return}
      requestAnimationFrame(loop);
    })(t0);
    setTimeout(()=>setLoad(1),7000);   // tope: nunca retiene la página más de unos segundos
    setTimeout(reveal,9500);
  }
}

/* palabras separadas una vez, con el texto completo para lectores de pantalla */
document.querySelectorAll('[data-split]').forEach(el=>{
  const words=el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label',words.join(' '));
  el.textContent='';
  words.forEach((w,i)=>{
    const s=document.createElement('span');
    s.className='w';s.setAttribute('aria-hidden','true');s.textContent=w;
    s.style.setProperty('--th',(i/words.length*.5).toFixed(3));
    el.appendChild(s);
    if(i<words.length-1)el.appendChild(document.createTextNode(' '));
  });
});

/* ---------- hero con scroll ---------- */
const bands=[...document.querySelectorAll('.band')].map((el,i,arr)=>({el,a:+el.dataset.a,b:+el.dataset.b,first:i===0,last:i===arr.length-1,op:-1,k:-1}));
const VIDEO_URL=asset('hero-scrub.mp4'),VIDEO_BYTES=3433692,TRAVEL=.92;
let target=0,shown=0,rafId=null,lastTick=0,heroOnScreen=true,loadK=0,failed=false,lastPe=-1;
let seekBusy=false,pendingTime=null,lastAlt='',lastAltAt=0,cueGone=false;

function heroProgress(){
  const r=hero.getBoundingClientRect(),range=r.height-innerHeight;
  return range>0?clamp(-r.top/range,0,1):0;
}
function requestSeek(t){
  if(!video.duration)return;
  if(seekBusy){pendingTime=t;return}
  seekBusy=true;video.currentTime=t;
}
video.addEventListener('seeked',()=>{seekBusy=false;if(pendingTime!==null){const t=pendingTime;pendingTime=null;requestSeek(t)}});
video.addEventListener('error',()=>{seekBusy=false;pendingTime=null;failVideo()});

function updateCaptions(p,now){
  for(const B of bands){
    const f=Math.min(.05,(B.b-B.a)/3);
    const op=(B.first?1:smoothstep(p,B.a,B.a+f))*(B.last?1:1-smoothstep(p,B.b-f,B.b));
    let k=clamp((p-B.a)/Math.min(.06,(B.b-B.a)*.35),0,1);
    if(B.first)k=Math.max(k,loadK);
    if(Math.abs(op-B.op)>.004||((op===0||op===1)&&op!==B.op)){
      B.op=op;B.el.style.opacity=op.toFixed(3);B.el.style.visibility=op===0?'hidden':'visible';
    }
    if(Math.abs(k-B.k)>.008||((k===0||k===1)&&k!==B.k)){B.k=k;B.el.style.setProperty('--k',k.toFixed(3))}
  }
  const travel=clamp(p/TRAVEL,0,1);
  if(now-lastAltAt>100){
    const m=Math.round(12000*(1-travel)/50)*50;
    const n=m.toLocaleString('en-US');
    const text=m>0?(EN?'Altitude '+n+' m':'Altitud '+n.replace(/,/g,' ')+' m'):(EN?'0 m · In production':'0 m · En producción');
    if(text!==lastAlt){lastAlt=text;lastAltAt=now;altEl.textContent=text}
  }
  const gone=p>.03;
  if(gone!==cueGone){cueGone=gone;cue.classList.toggle('gone',gone)}
  if(failed){
    const pe=+smoothstep(p,.42,.72).toFixed(2);
    if(pe!==lastPe){lastPe=pe;stage.style.setProperty('--pe',pe)}
  }
}
function tick(now){
  const dt=Math.min(100,now-(lastTick||now));lastTick=now;
  shown+=(target-shown)*(1-Math.pow(1-.24,dt/16.667));
  const settled=Math.abs(target-shown)<.0005;
  if(settled)shown=target;
  requestSeek(clamp(shown/TRAVEL,0,1)*(video.duration||0));
  updateCaptions(shown,now);
  if(settled&&loadK>=1){rafId=null;lastTick=0}
  else rafId=requestAnimationFrame(tick);
}
function kick(){if(rafId===null&&heroOnScreen)rafId=requestAnimationFrame(tick)}
function onScroll(){target=heroProgress();kick()}

function failVideo(){
  setLoad(1);
  if(failed)return;failed=true;
  stage.classList.add('video-failed');
  stage.style.setProperty('--poster-end',"url('"+asset('hero-ending.webp')+"')");
  kick();
}
async function loadHeroBlob(){
  const ctrl=new AbortController();
  let watchdog=setTimeout(()=>ctrl.abort(),20000);
  const res=await fetch(VIDEO_URL,{priority:'low',signal:ctrl.signal});
  if(!res.ok||!res.body)throw new Error('video');
  const total=Number(res.headers.get('Content-Length'))||VIDEO_BYTES;
  const reader=res.body.getReader(),chunks=[];
  let got=0,lastRing=0;
  for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    clearTimeout(watchdog);watchdog=setTimeout(()=>ctrl.abort(),20000);
    chunks.push(value);got+=value.length;
    const frac=Math.min(1,got/total),now=performance.now();
    if(now-lastRing>100||frac===1){lastRing=now;ring.style.setProperty('--ld',Math.round(126*(1-frac)));setLoad(frac*.94)}
  }
  clearTimeout(watchdog);
  ring.style.setProperty('--ld',0);
  video.src=URL.createObjectURL(new Blob(chunks,{type:'video/mp4'}));
  video.load();
  video.addEventListener('loadeddata',()=>{
    requestSeek(clamp(heroProgress()/TRAVEL,0,1)*video.duration);
    stage.classList.add('video-ready');
    setLoad(1);
  },{once:true});
}
let heroInit=false;
function initHeroOnce(){
  if(heroInit)return;heroInit=true;
  stage.style.setProperty('--poster',"url('"+asset('hero-poster.webp')+"')");
  loadHeroBlob().catch(failVideo);
  let ramped=false;
  const startRamp=()=>{
    if(ramped)return;ramped=true;
    const t0=performance.now();
    (function ramp(now){
      const t=clamp((now-t0)/900,0,1);
      loadK=1-Math.pow(1-t,3);
      kick();
      if(t<1)requestAnimationFrame(ramp);
    })(t0);
  };
  onReveal(()=>{
    (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(startRamp);
    setTimeout(startRamp,1200);
  });
}

const GATES=[
  '(max-width: 720px)',
  '(orientation: portrait) and (max-width: 1024px)',
  '(orientation: portrait) and (pointer: coarse)',
  '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
  '(prefers-reduced-motion: reduce)'
];
let scrubOn=false;
function enableScrub(){
  if(scrubOn)return;scrubOn=true;
  initHeroOnce();
  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',onScroll,{passive:true});
  bands.forEach(b=>{b.op=-1;b.k=-1});
  shown=target=heroProgress();
  updateCaptions(shown,performance.now());
  onScroll();
}
function disableScrub(){
  if(!scrubOn)return;scrubOn=false;
  removeEventListener('scroll',onScroll);
  removeEventListener('resize',onScroll);
  if(rafId!==null){cancelAnimationFrame(rafId);rafId=null}
  bands.forEach(b=>{b.el.style.opacity='';b.el.style.visibility='';b.el.style.removeProperty('--k')});
}
function applyHeroMode(){
  if(GATES.some(q=>matchMedia(q).matches)){
    disableScrub();
    // hero fijo: la carga termina cuando están la fuente y la imagen de fondo
    const img=new Image(),ready=()=>setLoad(1);
    img.onload=img.onerror=()=>(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(ready);
    img.src=asset('hero-ending.webp');
  }else enableScrub();
}
const MQLS=GATES.map(q=>matchMedia(q));
MQLS.forEach(m=>m.addEventListener('change',applyHeroMode));
new IntersectionObserver(e=>{heroOnScreen=e[0].isIntersecting;if(heroOnScreen&&scrubOn)onScroll()}).observe(hero);
applyHeroMode();

/* ---------- página ---------- */
const navWatch=()=>nav.classList.toggle('solid',scrollY>innerHeight*.6);
addEventListener('scroll',navWatch,{passive:true});navWatch();

function countUp(el){
  const end=+el.dataset.n;
  if(RM.matches){el.textContent=end;return}
  const t0=performance.now();
  (function step(now){
    const t=clamp((now-t0)/1400,0,1);
    el.textContent=Math.round(end*(1-Math.pow(1-t,3)));
    if(t<1)requestAnimationFrame(step);
  })(t0);
}
const io=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(!e.isIntersecting)return;
    e.target.classList.add('in');
    e.target.querySelectorAll('[data-n]').forEach(countUp);
    io.unobserve(e.target);
  });
},{threshold:.18,rootMargin:'0px 0px -6% 0px'});
document.querySelectorAll('.rv').forEach(el=>io.observe(el));

/* la línea de la trayectoria se dibuja con el scroll */
const track=$('#track'),xp=$('.xp');let lastP=-1,trackOn=false;
function drawTrack(){
  if(!trackOn||RM.matches)return;
  const r=track.getBoundingClientRect();
  const p=+clamp((innerHeight*.7-r.top)/r.height,0,1).toFixed(3);
  if(p!==lastP){lastP=p;track.style.setProperty('--p',p)}
}
new IntersectionObserver(e=>{trackOn=e[0].isIntersecting;xp.classList.toggle('live',trackOn);drawTrack()}).observe(xp);
addEventListener('scroll',drawTrack,{passive:true});

/* las herramientas caen en su capa al entrar en pantalla */
const layers=$('#layers');
layers.querySelectorAll('.chips').forEach(ul=>[...ul.children].forEach((li,i)=>li.style.setProperty('--i',i)));
new IntersectionObserver((e,o)=>{
  if(!e[0].isIntersecting)return;
  layers.classList.add('in');o.disconnect();
  setTimeout(()=>layers.classList.add('settled'),1800);
},{threshold:.25}).observe(layers);

/* movimiento reducido, en vivo y en ambos sentidos */
RM.addEventListener('change',e=>{
  if(e.matches){track.style.setProperty('--p',1);layers.classList.add('in','settled')}
  else{lastP=-1;drawTrack();applyHeroMode()}
});

document.addEventListener('visibilitychange',()=>document.body.classList.toggle('paused',document.hidden));
})();
