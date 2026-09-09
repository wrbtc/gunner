// Lightweight desktop briefing, available while the game modules prepare.
const $=id=>globalThis.document?.getElementById(id);
const chapterImage=globalThis.document?.querySelector('.chapter-image');if(chapterImage)chapterImage.src=chapterImage.dataset.src;
const stages={world:'Canyon surveyed',models:'Creatures identified',collision:'Flight path checked',shaders:'Guns prepared'};
const activity={assets:'Loading mission assets',scene:'Building the flight path',collision:'Checking the flight path',shaders:'Preparing flight visuals',restoring:'Restoring the flight'};
// Times use the page's performance clock, so observers can compare Resource
// Timing without treating post-response scheduling/construction as decode time.
export function createStartupTrace({now=()=>performance.now(),limit=96}={}){
 if(!Number.isInteger(limit)||limit<1||limit>256)throw TypeError('Invalid startup trace limit');
 const events=[];let dropped=0,cached=null;
 return Object.freeze({mark(name,state,outcome=null){
  cached=null;
  if(events.length>=limit){dropped++;return;}
  events.push(Object.freeze({name:String(name).slice(0,80),state:String(state).slice(0,24),at:now(),...(outcome===null?{}:{outcome:String(outcome).slice(0,40)})}));
 },snapshot:()=>cached||(cached=Object.freeze({events:Object.freeze(events.slice()),dropped}))});
}
const startupTrace=createStartupTrace();
export const startupMark=(name,state,outcome)=>startupTrace.mark(name,state,outcome);
startupMark('briefing','ready');
export function createLoadingController(onChange=()=>{}){
 const completed=new Set();let status='preparing',active='assets',progress=null,error=null;
 const snapshot=()=>Object.freeze({status,active,completed:Object.freeze([...completed]),progress:progress?Object.freeze({...progress}):null,error:error?Object.freeze({...error}):null});
 const publish=()=>{onChange(snapshot());return status!=='failed';};
 return Object.freeze({snapshot,begin(id,detail=null){if(status==='failed')return false;if(!activity[id])throw Error('Unknown preparation activity');status='preparing';active=id;progress=detail?{stage:detail.stage,completed:detail.completed,total:detail.total,...(typeof detail.label==='string'?{label:detail.label.slice(0,80)}:{})}:null;return publish();},
  complete(id){if(status==='failed')return false;if(!stages[id])throw Error('Unknown preparation stage');completed.add(id);if(completed.size===4){status='ready';progress=null;}return publish();},
  ready(){if(status==='failed')return false;if(completed.size!==4)throw Error('Flight preparation is incomplete');status='ready';progress=null;return publish();},
  fail(reason){if(status==='failed')return false;status='failed';error={code:reason?.code||'PREPARATION_FAILED',message:String(reason?.message||reason||'Flight preparation failed')};return publish();}
 });
}
export function boundedPreparation(work,{timeoutMs=30000,setTimer=setTimeout,clearTimer=clearTimeout,now=()=>performance.now()}={}){
 if(typeof work!=='function')throw TypeError('Preparation requires a task');
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw TypeError('Invalid preparation deadline');
 return new Promise((resolve,reject)=>{
  const started=now(),timeout=()=>Object.assign(Error('Flight preparation timed out'),{code:'PREPARATION_TIMEOUT'});
  let settled=false;const finish=(callback,value)=>{if(settled)return;settled=true;clearTimer(timer);callback(value);};
  const timer=setTimer(()=>finish(reject,timeout()),timeoutMs);
  Promise.resolve().then(work).then(value=>now()-started>=timeoutMs?finish(reject,timeout()):finish(resolve,value),error=>finish(reject,error));
 });
}
export function yieldLoadingPaint({frame=globalThis.requestAnimationFrame,cancelFrame=globalThis.cancelAnimationFrame,schedule=setTimeout,cancel=clearTimeout,fallbackMs=100}={}){
 if(!Number.isFinite(fallbackMs)||fallbackMs<=0)throw TypeError('Invalid paint-yield deadline');
 return new Promise(resolve=>{
  let settled=false,frameId=null,taskId=null,fallbackId=null;
  const finish=()=>{if(settled)return;settled=true;if(frameId!==null)cancelFrame?.(frameId);if(taskId!==null)cancel(taskId);if(fallbackId!==null)cancel(fallbackId);resolve();};
  // Background tabs may suspend animation frames. Yield a task even there;
  // the fallback promises progress, not a paint in an invisible document.
  fallbackId=schedule(finish,fallbackMs);
  if(frame)frameId=frame(()=>{frameId=null;if(!settled)taskId=schedule(finish,0);});
  else taskId=schedule(finish,0);
 });
}
// Keep construction ordered while allowing input/paint between complete steps
// and bounded internal batches. Cancellation is checked after every async gap.
export function createPreparationSequence({canceled=()=>false,now=()=>performance.now(),timeoutMs=30000,paint=yieldLoadingPaint,task=null,onStep=()=>{},Channel=globalThis.MessageChannel,setTimer=setTimeout,clearTimer=clearTimeout,fallbackMs=100}={}){
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw TypeError('Invalid construction deadline');
 if(!Number.isFinite(fallbackMs)||fallbackMs<=0)throw TypeError('Invalid construction task fallback');
 if(task!==null&&typeof task!=='function')throw TypeError('Construction task must be a function');
 const started=now();let busy=false,checkpointBusy=false,failure=null,channel=null,channelTried=false,pending=null,serial=0,deadlineTimer=null;
 const timeout=()=>Object.assign(Error('Flight construction timed out'),{code:'PREPARATION_TIMEOUT'});
 const cancelError=()=>Object.assign(Error('Flight construction was canceled'),{code:'PREPARATION_CANCELED'});
 const remainingMs=()=>Math.max(0,timeoutMs-(now()-started));
 const check=()=>{if(failure)throw failure;if(canceled())throw cancelError();if(remainingMs()<=0)throw timeout();};
 const closeChannel=()=>{const owned=channel;channel=null;if(owned){owned.port1.onmessage=null;owned.port1.close();owned.port2.close();}};
 const settle=(entry,error=null)=>{if(pending!==entry)return;pending=null;clearTimer(entry.timer);if(error)entry.reject(error);else entry.resolve();};
 const dispose=(error=cancelError())=>{failure ||= error;closeChannel();if(deadlineTimer!==null){clearTimer(deadlineTimer);deadlineTimer=null;}if(pending)settle(pending,failure);};
 function ensureChannel(){
  if(channelTried)return;channelTried=true;
  // One deadline owns the whole sequence, including idle gaps between steps.
  // It also closes ports if unrelated initialization throws between those steps.
  deadlineTimer=setTimer(()=>dispose(timeout()),remainingMs());
  if(typeof Channel==='function'){
   try{channel=new Channel();const owned=channel;owned.port1.onmessage=event=>{if(channel===owned&&pending?.id===event.data)settle(pending);};}
   catch{closeChannel();}
  }
 }
 function yieldTask(){
  ensureChannel();
  return new Promise((resolve,reject)=>{
   const entry={id:++serial,resolve,reject,timer:null};pending=entry;
   const fallback=()=>{
    if(pending!==entry)return;
    // A stalled/failed channel is retired permanently. No delayed message can
    // resolve a later checkpoint, and later yields use ordinary timer tasks.
    closeChannel();settle(entry);
   };
   entry.timer=setTimer(fallback,channel?Math.min(fallbackMs,remainingMs()):0);
   if(channel)try{channel.port2.postMessage(entry.id);}catch{closeChannel();clearTimer(entry.timer);entry.timer=setTimer(fallback,0);}
  });
 }
 // Messages are tasks, not a recursive microtask loop. There is only one
 // outstanding message/fallback; the outer step still explicitly yields paint.
 const checkpoint=async()=>{
  if(checkpointBusy)throw Error('Construction checkpoints must remain sequential');
  checkpointBusy=true;
  try{check();await(task?task():yieldTask());check();}
  catch(error){dispose(error);throw error;}
  finally{checkpointBusy=false;}
 };
 return Object.freeze({checkpoint,dispose,remainingMs,async step(name,work){
  if(busy)throw Error('Flight construction must remain sequential');
  busy=true;
  try{check();onStep(name,'begin');await paint();check();const value=await work();check();onStep(name,'end');await checkpoint();return value;}
  catch(error){dispose(error);throw error;}
  finally{busy=false;}
 }});
}

function renderLoading(state){
 for(const id of state.completed){const node=$('prep-'+id);if(node&&node.dataset.complete!=='true'){node.dataset.complete='true';node.setAttribute('aria-label',stages[id]);}}
 const node=$('loadStatus');if(!node)return;
 let detail=activity[state.active];
 if(state.active==='scene'&&state.progress?.label)detail=state.progress.label;
 if(state.active==='shaders'&&state.progress){
  const labels={submit:'Preparing flight visuals',link:'Checking flight visuals','first-use':'Finishing flight checks'};
  detail=labels[state.progress.stage]||detail;
  // Submission objects and linked programs use different units and totals.
  // Keep their exact counters in the read-only snapshot, not a false percent.
 }
 const text=state.status==='failed'?'Flight preparation could not finish. Please retry.':state.status==='ready'?'Ready for deployment':detail+' · '+state.completed.length+' of 4 systems ready';
 if(node.textContent!==text)node.textContent=text;
 node.classList.toggle('ready',state.status==='ready');$('loadingSystems')?.setAttribute('aria-busy',String(state.status==='preparing'));
}
const loading=createLoadingController(renderLoading);
export const loadingSnapshot=()=>Object.freeze({...loading.snapshot(),trace:startupTrace.snapshot()});
export const loadingStage=id=>loading.complete(id);
export const loadingProgress=(id,detail)=>loading.begin(id,detail);
export const loadingReady=()=>loading.ready();
const REPORT_BUILD='0.54.7',REPORT_ORIGIN='http://127.0.0.1:8000';
const reportText=(value,limit)=>String(value??'').slice(0,limit);
export function buildLoadingFailureReport(state,{origin=globalThis.location?.origin,userAgent=globalThis.navigator?.userAgent,visibilityState=globalThis.document?.visibilityState}={}){
 if(state?.status!=='failed')return null;
 let safeOrigin='unavailable';try{safeOrigin=new URL(origin).origin;}catch{}
 const trace=state.trace||{events:[],dropped:0},events=trace.events.slice(0,96);
 const loading={status:state.status,active:state.active,completed:[...state.completed],progress:state.progress?{stage:state.progress.stage,completed:state.progress.completed,total:state.progress.total,...(state.progress.label?{label:reportText(state.progress.label,80)}:{})}:null,error:state.error?{code:reportText(state.error.code,80),message:reportText(state.error.message,2048)}:null,trace:{events:events.map(e=>({name:reportText(e.name,80),state:reportText(e.state,24),at:e.at,...(e.outcome===undefined?{}:{outcome:reportText(e.outcome,40)})})),dropped:trace.dropped+Math.max(0,trace.events.length-96)}};
 return JSON.stringify({build:REPORT_BUILD,origin:reportText(safeOrigin,256),userAgent:reportText(userAgent,512),visibilityAtFailure:['visible','hidden'].includes(visibilityState)?visibilityState:'unavailable',loading},null,2);
}
function showLoadingFailureDetails(state){
 if(globalThis.location?.origin!==REPORT_ORIGIN||state.status!=='failed')return;
 const section=$('loadingFailureDetails'),detail=$('loadingFailureDetail'),button=$('copyLoadingReport'),disclosure=$('loadingReportDisclosure'),text=$('loadingReport'),status=$('loadingReportCopyStatus');
 if(!section||!detail||!button||!disclosure||!text||!status)return;
 const stage=state.active==='scene'&&state.progress?.label?state.progress.label:activity[state.active]||'Preparing the flight';
 const timedOut=state.error?.code==='PREPARATION_TIMEOUT',contextLost=state.error?.code==='PREPARATION_CANCELED'&&state.error?.message==='Graphics were lost during loading';
 detail.textContent=timedOut?'Loading timed out while '+stage.charAt(0).toLowerCase()+stage.slice(1)+'.':contextLost?'Graphics were lost while preparing the flight.':stage+' stopped before it could finish.';
 text.value=buildLoadingFailureReport(state);text.readOnly=true;section.hidden=false;
 let copying=false;
 const manualCopy=()=>{disclosure.open=true;text.focus();text.select();status.textContent='Select and copy the report below.';};
 button.addEventListener('click',async()=>{
  if(copying)return;copying=true;button.disabled=true;
  try{
   const clipboard=globalThis.navigator?.clipboard;
   if(typeof clipboard?.writeText!=='function'){manualCopy();return;}
   await clipboard.writeText(text.value);status.textContent='Loading report copied.';
  }catch{manualCopy();}
  finally{copying=false;button.disabled=false;}
 });
}
export function loadingFailure(error,{reload=()=>globalThis.location.reload()}={}){
 if(loading.snapshot().status==='failed')return;
 startupMark('startup','failed',error?.code||'PREPARATION_FAILED');
 const settings=$('settingsButton');if(settings)settings.disabled=true;
 loading.fail(error);
 showLoadingFailureDetails(loadingSnapshot());
 const button=$('startButton');if(button){const retry=button.cloneNode(true);retry.disabled=false;retry.textContent='RETRY LOADING';retry.addEventListener('click',()=>{retry.disabled=true;reload();},{once:true});const focused=globalThis.document.activeElement===button;button.replaceWith(retry);if(focused)retry.focus();}
 const intro=$('intro');if(intro)intro.hidden=false;
 for(const id of ['unsupported','pause','opening','ending','result']){const overlay=$(id);if(overlay)overlay.hidden=true;}
 $('hud')?.classList.remove('visible');
}
if(typeof window!=='undefined')Object.defineProperty(window,'__HIVE_LOADING__',{get:loadingSnapshot,configurable:false});
export const FIELD_GUIDE=Object.freeze([
 ['eggs','Brood eggs','THE OBJECTIVE','Membranous eggs cluster in nests and in the ruins.','Shoot the eggs directly. Each rupture adds to your score; clear clusters with the heavy cannon.'],
 ['creepers','Creepers','MUD THROWERS','Dark humanoids climb the walls and patrol the banks. Their mud coats the glass.','Hit them during the throwing windup to interrupt. Keep the guns on one while tracking the next threat.'],
 ['dancers','Dancing Creepers','THE RITUAL','Orange spirits dance around the altar. Disturbing their gathering wakes the group.','They become hostile when disturbed. Shoot through their windup to interrupt their throws.'],
 ['rimmers','Rimmers','LASER / FLASHBANG','A red targeting laser precedes the incoming spike. A hit leaves a blinding afterimage.','Trace the laser back to the creature and interrupt its charge, or shoot down the incoming spike.'],
 ['tanks','Tank · Cinder Maw','FIRE BREATHER','A low volcanic beast with layered rock armour and a furnace mouth.','Sustain fire into the charging creature to interrupt it. Shoot incoming fireballs; use the cannon for heavy damage.'],
 ['plasma','Plasma bugs','VOLATILE','Small armoured scarabs climb the canyon walls. Their red sacs burst with a dangerous pressure wave.','Detonate them while the plane is still distant. Their blast can catch nearby creatures.'],
 ['dragons','Dragons','AIRBORNE','Winged creatures cross the canyon overhead.','Track the moving body with sustained fire. The heavy cannon can damage them when its shell connects.'],
 ['queen','The Queen','FINAL ENCOUNTER','Eight tentacles guard the Queen. The red tips are your targets.','Break every red tip. Shoot incoming attacks to protect the hull, and exploit the pauses between volleys.']
]);
const dialog=$('fieldGuide'),trigger=$('fieldGuideButton');
if(dialog&&trigger){
 const grid=$('guideEntries');
 for(const [id,name,tag,description,counter]of FIELD_GUIDE){
  const card=document.createElement('article');card.className='guide-entry';card.dataset.creature=id;
  const mark=document.createElement('figure');mark.className='guide-portrait '+id;
  const portrait=document.createElement('img');portrait.dataset.src='./assets/field-guide/'+id+(id==='tanks'?'.jpg':'.png')+'?v=054';portrait.alt=id==='queen'?"The Queen's silhouette; her appearance remains unknown":name+' — model identification';portrait.width=512;portrait.height=384;portrait.decoding='async';mark.append(portrait);
  const copy=document.createElement('div');
  for(const [tagName,text,cls]of [['span',tag,'guide-tag'],['h3',name,''],['p',description,''],['h4','COUNTERPLAY',''],['p',counter,'guide-counter']]){const node=document.createElement(tagName);node.textContent=text;if(cls)node.className=cls;copy.append(node);}
  card.append(mark,copy);grid.append(card);
 }
 function close(){dialog.close();}
 trigger.addEventListener('click',()=>{for(const img of dialog.querySelectorAll('img[data-src]')){if(!img.src)img.src=img.dataset.src;}dialog.showModal();trigger.setAttribute('aria-expanded','true');$('closeGuide').focus();});
 $('closeGuide').addEventListener('click',close);
 dialog.addEventListener('click',e=>{const b=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom))close();});
 dialog.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');trigger.focus();});
 dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Tab'){const nodes=[...dialog.querySelectorAll('button,a[href],[tabindex="0"]')];const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
}
