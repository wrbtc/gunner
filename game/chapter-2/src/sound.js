import {noiseBands,modalBody,finishAudioBuffer,weaponSoundBuffer,queenSoundBuffer} from '../../src/audio-palette.js?v=052';
import {creatureBuffer} from '../../src/creature-audio.js?v=052';
import {mudImpactBuffer} from '../../src/wet-impact.js?v=052';
import {synthFeedbackProof} from '../../src/mayhem-audio.js?v=054-6';

// Chapter 2's sound, all synthesized here or by Chapter 1's palette: no samples, no downloads.
// The rotor and wind loop; everything else is a one-shot placed in the world and heard from
// the camera. In the sensor you sit in the cabin, so the world and the rotor come through
// muffled and your own gun is close; in the outside view the blades open up.
const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

function formant(sr,hz,q){
 const w=TAU*Math.min(hz,sr*.42)/sr,alpha=Math.sin(w)/(2*q),inv=1/(1+alpha),b0=alpha*inv,a1=-2*Math.cos(w)*inv,a2=(1-alpha)*inv;
 let x1=0,x2=0,y1=0,y2=0;
 return x=>{const y=b0*(x-x2)-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
}
function make(ctx,duration,fill,options){
 const sr=ctx.sampleRate,buffer=ctx.createBuffer(1,Math.ceil(sr*duration),sr),a=buffer.getChannelData(0);
 fill(a,sr);return finishAudioBuffer(buffer,options);
}

// Four main blades passing 13.5 times a second, one a little heavier so the beat turns; the
// tail rotor's buzz, the turbines' whine and the gearbox hum. Every tone fits the 4 s loop.
function rotorBuffer(ctx){
 return make(ctx,4,(a,sr)=>{
  const noise=noiseBands(sr,0x7e11);
  for(let i=0;i<a.length;i++){
   const t=i/sr,n=noise(),k=Math.floor(t*13.5),tp=t-k/13.5,accent=k%4===0?1:.7;
   const slap=accent*((n.body*1.5+n.low*5.5)*Math.exp(-tp*34)+Math.sin(TAU*58*tp)*.42*Math.exp(-tp*26));
   const tail=(Math.sin(TAU*81*t)*.09+Math.sin(TAU*162*t)*.04)*(.65+.35*Math.sin(TAU*13.5*t))+n.air*.05;
   const turbine=Math.sin(TAU*3150*t)*.022+Math.sin(TAU*6300*t)*.008+n.edge*.025;
   a[i]=Math.tanh(slap+tail+turbine+Math.sin(TAU*40.5*t)*.11);
  }
 },{peak:.8,rmsCeiling:.24,loop:true});
}
// The 30 mm chain gun: a hard snap, a deep chest punch and the feed's clank.
function gunBuffer(ctx,seed){
 return make(ctx,.42,(a,sr)=>{
  const noise=noiseBands(sr,seed),steel=modalBody(sr,[[880,.03,.3],[2150,.02,.16],[3900,.012,.08]]),clank=Math.round(.034*sr);
  let phase=0;
  for(let i=0;i<a.length;i++){
   const t=i/sr,n=noise();phase+=TAU*(52+150*Math.exp(-t*40))/sr;
   const snap=n.edge*1.05*Math.exp(-t*300)+n.air*.3*Math.exp(-t*90);
   const punch=(Math.sin(phase)*.85+n.low*6.2+n.body*.55)*Math.exp(-t*15);
   const tail=(n.low*2.2+n.body*.3)*(t<.03?0:Math.exp(-(t-.03)*9));
   a[i]=Math.tanh(snap+punch+steel(i===clank?.5:0)+tail);
  }
 },{peak:.82,rmsCeiling:.23,attack:.0008});
}
// A motor lighting: a crack, then a tearing roar that flutters and falls away. The missile
// drops off its rail with a clunk first and burns longer and lower.
function motorBuffer(ctx,missile){
 const duration=missile?2:1.1;
 return make(ctx,duration,(a,sr)=>{
  const noise=noiseBands(sr,missile?0x3155:0x40c7),rail=modalBody(sr,[[310,.09,.4],[760,.05,.22],[1900,.025,.1]]);
  const light=missile?.12:0;let crackle=0;
  for(let i=0;i<a.length;i++){
   const t=i/sr,n=noise(),b=t-light;let v=rail(missile&&i===1?.9:0);
   if(b>=0){
    const ignite=n.edge*1.2*Math.exp(-b*80)+n.air*.6*Math.exp(-b*25);
    const env=Math.min(1,b/.03)*Math.exp(-b*(missile?1.1:2.3));
    const roar=(n.air*1.1+n.body*.85+n.low*(missile?4:2.4))*env*(.75+.25*Math.sin(TAU*31*t));
    if(n.white>.993)crackle=.35*env;crackle*=.9;
    v+=ignite+roar+crackle*n.edge;
   }
   a[i]=Math.tanh(v);
  }
 },{peak:.8,rmsCeiling:.22});
}
// The infected: a raw scream through a torn throat. Brutes use the Queen's warning call.
function shriekBuffer(ctx,base,seed){
 return make(ctx,.9,(a,sr)=>{
  const noise=noiseBands(sr,seed),f1=formant(sr,850,2.4),f2=formant(sr,2350,3),f3=formant(sr,3500,4);
  let phase=0;
  for(let i=0;i<a.length;i++){
   const t=i/sr,u=t/.9,n=noise();
   phase+=TAU*base*(1+.28*Math.sin(Math.PI*u)+.03*Math.sin(TAU*23*t))/sr;
   const folds=Math.tanh(Math.sin(phase)*4)*.4+n.body*1.3;
   const vocal=f1(folds)*2+f2(folds+n.air*.4)*1.2+f3(n.air)*.45;
   const env=Math.sin(Math.PI*u)**.6*(1-.3*u);
   a[i]=Math.tanh((vocal+n.air*.15)*env*1.4);
  }
 },{peak:.75,rmsCeiling:.2,attack:.01,release:.06});
}
// Radio: a burst of band-limited hiss and a click, at the start and the end of each call.
function squelchBuffer(ctx){
 return make(ctx,.18,(a,sr)=>{
  const noise=noiseBands(sr,0x5a1c),band=formant(sr,2200,1.4);
  for(let i=0;i<a.length;i++){const t=i/sr,n=noise();a[i]=band(n.white)*1.6*Math.min(1,t/.004)*Math.exp(-t*16)+(i<sr*.002?.6:0);}
 },{peak:.5,rmsCeiling:.16});
}
// The missile seeker's tone while it flies.
function beepBuffer(ctx){
 return make(ctx,.07,(a,sr)=>{for(let i=0;i<a.length;i++){const t=i/sr;a[i]=(Math.sin(TAU*1250*t)+.3*Math.sin(TAU*2500*t))*Math.sin(Math.PI*t/.07);}},{peak:.4,rmsCeiling:.15});
}

// How far each kind of sound carries: [reference distance, rolloff]. Blasts carry across the
// city; voices and rifles need you close.
const CARRY={blast:[220,.6],gun:[120,.8],launch:[60,1],voice:[70,1],near:[30,1.2]};
const CUES=['hit-confirm','kill','low-hull','gun-overheat','gun-cooled','cannon-ready','cannon-empty','victory','loss'];
const CUE_LEVEL={'hit-confirm':.12,kill:.14,'low-hull':.2,'gun-overheat':.2,'gun-cooled':.15,'cannon-ready':.15,'cannon-empty':.1,victory:.28,loss:.28};
const CUE_GAP={'hit-confirm':.045,kill:.12,'low-hull':4,'gun-overheat':1,'gun-cooled':1,'cannon-ready':.35,'cannon-empty':.3,victory:8,loss:8};

export function createSound(){
 let ctx=null,running=false,muted=false,volume=.65;
 const buffers={},voices=new Set(),last={},jobs=[];
 let master,world,cabin,own,feedback,rotorBus,rotorFilter,rotor,wind,windGain,beepClock=0;
 try{const saved=JSON.parse(localStorage.getItem('gunner-settings-v1')||'{}');if(Number.isFinite(saved.volume))volume=clamp(saved.volume,0,1);}catch{}
 try{muted=localStorage.getItem('gunner-ch2-muted')==='1';}catch{}

 // Every buffer, built a few per tick while the page loads so take off doesn't stall.
 function plan(){
  const c=ctx,add=(key,fn)=>jobs.push([key,fn]);
  add('rotor',()=>rotorBuffer(c));
  for(let i=0;i<3;i++)add('gun'+i,()=>gunBuffer(c,0x30a+i*97));
  add('rocket',()=>motorBuffer(c,false));add('missile',()=>motorBuffer(c,true));
  for(const [kind,duration] of [['boom',2.4],['cannonImpact',1.7],['rock',.35],['flesh',.21],['metal',.21],['flyby',.48],['rumble',3],['gun',.27]])add(kind,()=>weaponSoundBuffer(c,duration,kind,891+duration*100));
  [[310,0xa1],[365,0xb2],[430,0xc3]].forEach(([hz,seed],i)=>add('shriek'+i,()=>shriekBuffer(c,hz,seed)));
  add('roar',()=>queenSoundBuffer(c,1.1,'queen-attack'));add('wet',()=>mudImpactBuffer(c));
  add('fall',()=>creatureBuffer(c,'creeper',true));add('zap',()=>creatureBuffer(c,'plasma',false));
  add('squelch',()=>squelchBuffer(c));add('beep',()=>beepBuffer(c));
  for(const kind of CUES)add('cue-'+kind,()=>synthFeedbackProof(c,kind));
 }
 function build(all=false){
  const until=performance.now()+(all?1e9:6);
  while(jobs.length&&performance.now()<until){const [key,fn]=jobs.shift();try{buffers[key]=fn();}catch{}}
  if(jobs.length&&!all)setTimeout(()=>build(),16);
 }
 function graph(){
  master=ctx.createGain();master.gain.value=muted?0:volume;
  const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=8;limiter.ratio.value=8;limiter.attack.value=.002;limiter.release.value=.15;
  master.connect(limiter);limiter.connect(ctx.destination);
  // The world comes in through the cabin's walls: a low-pass that closes in the sensor view.
  cabin=ctx.createBiquadFilter();cabin.type='lowpass';cabin.frequency.value=18000;cabin.connect(master);
  world=ctx.createGain();world.gain.value=1;world.connect(cabin);
  own=ctx.createGain();own.gain.value=1;own.connect(master);
  feedback=ctx.createGain();feedback.gain.value=.85;feedback.connect(master);
  rotorFilter=ctx.createBiquadFilter();rotorFilter.type='lowpass';rotorFilter.frequency.value=900;
  rotorBus=ctx.createGain();rotorBus.gain.value=0;rotorFilter.connect(rotorBus);rotorBus.connect(master);
 }
 function loop(buffer,destination,gain){
  const src=ctx.createBufferSource(),g=ctx.createGain();src.buffer=buffer;src.loop=true;
  src.loopStart=Math.min(1024,Math.floor(buffer.length/4))/buffer.sampleRate;g.gain.value=gain;
  src.connect(g);g.connect(destination);src.start();return {src,gain:g};
 }
 function play(key,level,{at=null,carry='gun',pitch=1,bus=null,priority=1,gap=0}={}){
  const buffer=buffers[key];if(!ctx||!running||!buffer)return null;
  const now=ctx.currentTime;if(gap&&now-(last[key]??-9)<gap)return null;last[key]=now;
  if(voices.size>=40){const victim=[...voices].find(v=>v.priority<priority);if(!victim)return null;end(victim);}
  const src=ctx.createBufferSource(),g=ctx.createGain();src.buffer=buffer;src.playbackRate.value=pitch;g.gain.value=level;src.connect(g);
  let node=g;
  if(at){
   const p=ctx.createPanner(),[ref,roll]=CARRY[carry];p.panningModel='equalpower';p.distanceModel='inverse';p.refDistance=ref;p.rolloffFactor=roll;p.maxDistance=4000;
   p.positionX.value=at.x;p.positionY.value=at.y;p.positionZ.value=at.z;g.connect(p);node=p;
  }
  node.connect(bus||world);
  const voice={src,g,node,priority};voices.add(voice);src.onended=()=>end(voice,false);src.start();return voice;
 }
 function end(voice,stop=true){
  if(!voices.has(voice))return;voices.delete(voice);voice.src.onended=null;
  if(stop)try{voice.src.stop();}catch{}
  voice.src.disconnect();voice.g.disconnect();if(voice.node!==voice.g)voice.node.disconnect();
 }
 const api={
  // Called as the page loads: the context starts suspended and the sounds are built in the
  // background. Browsers only let it play after a click, which start() is called from.
  prepare(){
   if(ctx)return;
   const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;
   try{ctx=new Context({latencyHint:'interactive'});}catch{ctx=null;return;}
   graph();plan();setTimeout(()=>build(),0);
  },
  start(){
   if(!ctx)api.prepare();if(!ctx)return;
   build(true);
   if(!rotor&&buffers.rotor){rotor=loop(buffers.rotor,rotorFilter,1);wind=loop(buffers.rumble,world,.16);windGain=wind.gain;}
   running=true;ctx.resume?.().catch(()=>{});
   const now=ctx.currentTime;rotorBus.gain.cancelScheduledValues(now);rotorBus.gain.setTargetAtTime(.7,now,.4);world.gain.setTargetAtTime(1,now,.1);
  },
  pause(){if(!ctx)return;running=false;for(const v of [...voices])end(v);ctx.suspend?.().catch(()=>{});},
  // The round is over: the rotor winds down and the world falls quiet; the result cue plays on.
  end(won){
   if(!ctx||!running)return;api.cue(won?'victory':'loss');const now=ctx.currentTime;
   rotorBus.gain.setTargetAtTime(0,now,won?1.2:.25);world.gain.setTargetAtTime(.25,now,.8);
  },
  toggleMute(){
   muted=!muted;try{localStorage.setItem('gunner-ch2-muted',muted?'1':'0');}catch{}
   if(master)master.gain.setTargetAtTime(muted?0:volume,ctx.currentTime,.03);return muted;
  },
  get muted(){return muted;},
  // Each frame: the listener rides the camera; the cabin and the rotor follow the view and
  // the collective; the seeker tone beeps while a missile is in the air.
  update(dt,{camera,inside,lift=0,guiding=false}){
   if(!ctx||!running)return;
   const now=ctx.currentTime,l=ctx.listener,p=camera.position,e=camera.matrixWorld.elements,f={x:-e[8],y:-e[9],z:-e[10]};
   if(l.positionX){l.positionX.setValueAtTime(p.x,now);l.positionY.setValueAtTime(p.y,now);l.positionZ.setValueAtTime(p.z,now);
    l.forwardX.setValueAtTime(f.x,now);l.forwardY.setValueAtTime(f.y,now);l.forwardZ.setValueAtTime(f.z,now);l.upX.setValueAtTime(0,now);l.upY.setValueAtTime(1,now);l.upZ.setValueAtTime(0,now);}
   else{l.setPosition(p.x,p.y,p.z);l.setOrientation(f.x,f.y,f.z,0,1,0);}
   cabin.frequency.setTargetAtTime(inside?2600:18000,now,.08);
   rotorFilter.frequency.setTargetAtTime(inside?750:5200,now,.08);
   if(rotor){
    rotor.src.playbackRate.setTargetAtTime(1+.05*clamp(lift,-1,1),now,.35);
    rotorBus.gain.setTargetAtTime((inside?.55:.85)*(1+.18*Math.max(0,lift)),now,.25);
   }
   if(guiding){beepClock-=dt;if(beepClock<=0){beepClock=.45;play('beep',.16,{bus:feedback,priority:3});}}else beepClock=0;
  },
  // Your weapons: the chin gun close in the cabin, launches from the pods.
  fire(weapon,at){
   if(weapon==='gun')play('gun'+(Math.random()*3|0),.62,{bus:own,pitch:.96+Math.random()*.08,priority:2});
   else if(weapon==='rockets')play('rocket',.5,{at,carry:'launch',pitch:.95+Math.random()*.1,priority:2});
   else play('missile',.8,{at,carry:'launch',priority:3});
  },
  impact(weapon,at){
   if(weapon==='gun')play('rock',.32,{at,carry:'gun',pitch:.7+Math.random()*.3,gap:.03});
   else if(weapon==='rockets')play('boom',.62,{at,carry:'blast',pitch:1.05+Math.random()*.15,priority:2});
   else{play('cannonImpact',.95,{at,carry:'blast',priority:3});play('boom',.7,{at,carry:'blast',pitch:.72,priority:3});}
  },
  // Thrown junk and the Lamplighters' bolts as they leave, and as they pass close.
  launch(kind,at,scale=1){
   if(kind==='bolt')play('zap',.4,{at,carry:'voice',pitch:1.3,gap:.08});
   else if(scale>1)play('flyby',.35,{at,carry:'voice',pitch:.5,gap:.2});
  },
  flyby(at){play('flyby',.4,{at,carry:'near',priority:2,gap:.15});},
  damage(){play('metal',.5,{bus:own,pitch:.55,priority:3});play('boom',.3,{bus:own,pitch:1.35,priority:3});},
  rifle(at){play('gun',.14,{at,carry:'voice',pitch:1.3+Math.random()*.15,gap:.05});},
  scream(type,at){
   if(type==='brute')play('roar',.55,{at,carry:'voice',pitch:.85,gap:.4});
   else play('shriek'+(Math.random()*3|0),type==='leaper'?.55:.32,{at,carry:'voice',pitch:type==='leaper'?1.25:.9+Math.random()*.25,gap:.12});
  },
  death(type,at){
   if(type==='hurler'||type==='lamplighter')play('fall',.6,{at,carry:'blast',priority:2});
   else play('flesh',.42,{at,carry:'voice',pitch:type==='brute'?.6:.85+Math.random()*.3,gap:.04});
  },
  burst(at){play('wet',.85,{at,carry:'blast',priority:2});play('boom',.4,{at,carry:'blast',pitch:1.3,priority:2});},
  radio(){play('squelch',.5,{bus:feedback,priority:3,gap:.1});},
  cue(kind){if(CUE_LEVEL[kind])play('cue-'+kind,CUE_LEVEL[kind],{bus:feedback,priority:3,gap:CUE_GAP[kind]});},
  stats:()=>({context:ctx?.state||'none',buffers:Object.keys(buffers).length,pending:jobs.length,voices:voices.size,muted,failed})
 };
 // Sound must never stop the game: if a browser throws anywhere in here, it goes quiet instead.
 let failed=null;
 for(const key of Object.keys(api)){
  const fn=api[key];if(typeof fn!=='function'||key==='stats')continue;
  api[key]=(...args)=>{if(failed)return;try{return fn(...args);}catch(error){failed=String(error);try{master?.disconnect();}catch{}console.warn('Chapter 2 sound is off:',error);}};
 }
 return api;
}
