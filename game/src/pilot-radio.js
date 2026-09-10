import {PILOT_LINES} from './pilot-lines.js?v=054';
import {PILOT_AUDIO} from './pilot-audio-map.js?v=054-10';
import {createPilotQueue} from './pilot-queue.js?v=052';
export function createPilotRadio({audio,caption,voiceVolume=.85,captions=true,audioMap=PILOT_AUDIO}){
 const delivered=new Set();let transmission=null,lossRequestedAt=null;
 let loadMs=0,decodeMs=0,voiceGeneration=0,buffer=null,load='idle',loadGeneration=0,controller=null,source=null,gain=null,gainContext=null,volume=voiceVolume,showCaptions=captions,visibleText='',result=false,won=false,paused=false,routeSeen=new Set(),openingBoarded=false,lastProgress=0,fetchBytes=0,decodedBytes=0,lateDecodes=0,playedAudio=0,activeAudio=0,maxActiveAudio=0;
 function renderCaption(){const text=visibleText?'PILOT · '+visibleText:'',hidden=!showCaptions||!visibleText||paused;if(caption.textContent!==text)caption.textContent=text;if(caption.hidden!==hidden)caption.hidden=hidden;}
 function stopVoice(){voiceGeneration++;if(source){try{source.stop();}catch{}source.disconnect();source=null;}activeAudio=0;audio.setVoiceDucking?.(false);visibleText='';renderCaption();}
 const queue=createPilotQueue({lines:PILOT_LINES,onStart:item=>{
  transmission=item;item.deliveryQualified=showCaptions;visibleText=item.text;renderCaption();const clip=audioMap.clips[item.id],ctx=audio.ctx;
  if(!buffer||!clip||volume<=0||audio.muted||audio.volume<=0||!ctx||ctx.state==='closed')return;
  const generation=voiceGeneration;
  function start(){
   // resume() can settle after reset, interruption, mute, or a new context.
   if(generation!==voiceGeneration||audio.ctx!==ctx||ctx.state!=='running'||paused||volume<=0||audio.muted||audio.volume<=0||queue.clock-item.startedAt>1.5)return;
   if(gainContext!==ctx){gain?.disconnect();gain=ctx.createGain();gain.connect(audio.master);gainContext=ctx;}
   gain.gain.value=volume*.9;source=ctx.createBufferSource();source.buffer=buffer;source.connect(gain);source.start(0,clip.offset,clip.duration);item.deliveryQualified=true;item.endsAt=queue.clock+clip.duration;activeAudio=1;maxActiveAudio=Math.max(maxActiveAudio,activeAudio);playedAudio++;audio.setVoiceDucking?.(true);
  }
  if(result){const resumed=audio.resumeRadioOnly?.();if(ctx.state==='running')start();else Promise.resolve(resumed).then(start).catch(()=>{});}else start();
 },onStop:(item,reason)=>{if(reason==='finished'&&item.deliveryQualified)delivered.add(item.id);transmission=null;stopVoice();}});
 function request(id,options={}){return queue.request(id,{duration:audioMap.clips[id]?.duration,...options});}
 async function prime(){
  const ctx=audio.ctx;if(!ctx||load==='loading'||load==='ready'||!audioMap.url)return;
  const loadStarted=performance.now(),token=++loadGeneration;controller?.abort();controller=new AbortController();const abort=controller;load='loading';let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;abort.abort();if(token===loadGeneration){loadGeneration++;load='unavailable';}},12000);
  try{
   const response=await fetch(new URL(audioMap.url,import.meta.url),{signal:abort.signal,credentials:'same-origin'});if(!response.ok)throw Error('voice-response');
   const reader=response.body?.getReader();if(!reader)throw Error('voice-stream');const chunks=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1572864){await reader.cancel();throw Error('voice-download-budget');}chunks.push(value);}
   fetchBytes=size;const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const decodeStarted=performance.now(),decoded=await ctx.decodeAudioData(bytes.buffer);
   // A deadline cannot cancel native decode. Discard stale completion entirely.
   if(token!==loadGeneration||timedOut||ctx!==audio.ctx){lateDecodes++;return;}
   const memory=decoded.length*decoded.numberOfChannels*4;
   if(decoded.numberOfChannels!==1||decoded.duration>150.5||memory>32*1024*1024)throw Error('voice-decode-budget');
   for(const [id,clip]of Object.entries(audioMap.clips))if(!PILOT_LINES[id]||!Number.isFinite(clip.offset)||!Number.isFinite(clip.duration)||clip.offset<0||clip.duration<=0||clip.offset+clip.duration>decoded.duration+.01)throw Error('voice-clip-map');
   buffer=decoded;decodedBytes=memory;loadMs=performance.now()-loadStarted;decodeMs=performance.now()-decodeStarted;load='ready';
  }catch{if(token===loadGeneration)load='unavailable';}finally{clearTimeout(timer);}
 }
 function victoryPending(){const s=queue.stats();return s.active?.id==='victory'||s.queued.some(i=>i.id==='victory');}
 function event(type,data={}){
  if(type==='opening-start')request('mission');
  else if(type==='run-start'){queue.clear('boarding-complete');request('weapons');}
  else if(type==='queen-phase'&&data.phase==='calm'){queue.clear('queen-approach');request('queenApproach');}
  else if(type==='queen-phase'&&data.phase==='intro')request('queenIntro');
  else if(type==='queen-combat-start'){queue.clear('combat-start');request('queenCombat');}
  else if(type==='queen-reload-start')request('queenReload');
  else if(type==='queen-phase'&&data.phase==='death'){queue.clear('queen-down');request('victory');}
  else if(type==='escaped'||type==='lost'){won=type==='escaped';if(!won||!victoryPending())queue.clear('run-ended');if(won&&!queue.hasPlayed('victory'))request('victory');if(type==='lost'){lossRequestedAt=queue.clock;request('mayday');}}
 }
 function update(dt,state){
  const wasPaused=paused;paused=!!(state.paused||state.hidden||state.contextLost||state.captureFreeze);
  if(result&&paused!==wasPaused){if(paused)audio.pause?.();else audio.resumeRadioOnly?.();}
  renderCaption();
  if(paused)return;
  if(source&&(volume<=0||audio.muted||audio.volume<=0)){try{source.stop();}catch{}source.disconnect();source=null;activeAudio=0;audio.setVoiceDucking?.(false);}
  if(state.opening&&!openingBoarded&&state.openingTime>=9){openingBoarded=true;request('boarding');}
  if(state.running&&!state.opening&&!state.ended){
   const p=state.progress;
   const route=(id,at)=>{if(!Number.isFinite(at)||routeSeen.has(id))return;if(p>=at&&p<at+.045){routeSeen.add(id);request(id);}else if(p>=at+.045)routeSeen.add(id);};
   route('nests',state.firstNestAt);route('altar',state.altarAt);
   lastProgress=p;
  }
  if(transmission&&!showCaptions&&!(source&&audio.ctx?.state==='running'&&volume>0&&!audio.muted&&audio.volume>0))transmission.deliveryQualified=false;
  const lossReady=lossRequestedAt===null||queue.clock-lossRequestedAt>1.5||!buffer||volume<=0||audio.muted||audio.volume<=0||audio.ctx?.state==='running';
  queue.update(dt,{ready:(load!=='loading'||queue.clock>1.5)&&lossReady});
 }
 function reset(){lossRequestedAt=null;loadGeneration++;controller?.abort();controller=null;if(load==='loading')load='idle';queue.reset();delivered.clear();stopVoice();result=won=paused=false;routeSeen.clear();openingBoarded=false;lastProgress=0;}
 return{prime,event,update,reset,request,
  setVolume(value){volume=Math.max(0,Math.min(1,Number(value)||0));if(gain&&audio.ctx)gain.gain.setTargetAtTime(volume*.9,audio.ctx.currentTime,.02);},
  setCaptions(value){showCaptions=!!value;renderCaption();},
  showResult(){if(!victoryPending())queue.clear('result-screen');result=true;if(victoryPending()&&!paused)audio.resumeRadioOnly?.();},
  topTen(){if(result)request('topTen');},
  stats:()=>({delivered:[...delivered],load,loadMs,decodeMs,audioSampleRate:audio.ctx?.sampleRate??null,fetchBytes,decodedBytes,lateDecodes,playedAudio,activeAudio,maxActiveAudio,volume,captions:showCaptions,result,won,lastProgress,...queue.stats()})};
}
