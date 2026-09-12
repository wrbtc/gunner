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
const startupTrace=createStartupTrace();let onStartupChange=()=>{},bootHeartbeat=()=>{};
export function bindBootHeartbeat(fn){bootHeartbeat=typeof fn==='function'?fn:()=>{};}
export const startupMark=(name,state,outcome)=>{startupTrace.mark(name,state,outcome);onStartupChange();if(state!=='failed')bootHeartbeat();};
export const LOADING_ITEMS=Object.freeze(['world','models','aircraft','creatures','grounding','tracking','support-index','tanks','blast','nests','ruins','gallery','dance','bank','spray','rimmers','plasma','collision-map','climbers','queen','atmosphere','audio','collision','shaders']);
export function completedLoadingItems(state,events){
 const done=new Set(state.completed);
 for(const event of events)if(event.name.startsWith('assembly:')&&event.state==='end'){
  const id=event.name.slice(9);done.add(id==='collision'?'collision-map':id);
 }
 return LOADING_ITEMS.filter(id=>done.has(id));
}
startupMark('briefing','ready');
export function createLoadingController(onChange=()=>{}){
 const completed=new Set();let status='preparing',active='assets',progress=null,error=null;
 const snapshot=()=>Object.freeze({status,active,completed:Object.freeze([...completed]),progress:progress?Object.freeze({...progress}):null,error:error?Object.freeze({...error}):null});
 const publish=()=>{onChange(snapshot());return status!=='failed';};
 return Object.freeze({snapshot,begin(id,detail=null){if(status==='failed')return false;if(!activity[id])throw Error('Unknown preparation activity');status='preparing';active=id;progress=detail?{stage:detail.stage,completed:detail.completed,total:detail.total,...(typeof detail.label==='string'?{label:detail.label.slice(0,80)}:{}),...(detail.preTimeoutSnapshot?{preTimeoutSnapshot:detail.preTimeoutSnapshot}:{})}:null;return publish();},
  complete(id){if(status==='failed')return false;if(!stages[id])throw Error('Unknown preparation stage');completed.add(id);if(completed.size===4){status='ready';progress=null;}return publish();},
  ready(){if(status==='failed')return false;if(completed.size!==4)throw Error('Flight preparation is incomplete');status='ready';progress=null;return publish();},
  fail(reason){if(status==='failed')return false;status='failed';error={code:reason?.code||'PREPARATION_FAILED',message:String(reason?.message||reason||'Flight preparation failed')};return publish();}
 });
}
// Background tabs starve rAF/MessageChannel. Wall clocks keep running, so a
// hidden interval must not burn the visible construction/preparation budget.
function pageIsHidden(doc=globalThis.document){
 const state=doc?.visibilityState;
 if(typeof state==='string')return state!=='visible';
 return !!doc?.hidden;
}
function watchPageVisibility(onChange,subscribe,doc=globalThis.document){
 if(typeof subscribe==='function')return subscribe(onChange)||(()=>{});
 if(typeof doc?.addEventListener!=='function')return ()=>{};
 doc.addEventListener('visibilitychange',onChange);
 return ()=>doc.removeEventListener?.('visibilitychange',onChange);
}
function createVisibleDeadline({now,timeoutMs,hidden=pageIsHidden,subscribe,setTimer,clearTimer}={}){
 const started=now();
 let hiddenMs=0,hiddenSince=null,timer=null,closed=false,armed=false,onExpired=null;
 const unseen=()=>{try{return !!hidden();}catch{return false;}};
 const sync=()=>{
  const t=now(),hide=unseen();
  if(hide){if(hiddenSince===null)hiddenSince=t;}
  else if(hiddenSince!==null){hiddenMs+=Math.max(0,t-hiddenSince);hiddenSince=null;}
  return t;
 };
 const remainingMs=()=>{
  const t=sync();
  const end=hiddenSince===null?t:hiddenSince;
  return Math.max(0,timeoutMs-(end-started-hiddenMs));
 };
 const stopTimer=()=>{if(timer!==null){clearTimer(timer);timer=null;}};
 const arm=()=>{
  if(closed||!armed)return;
  stopTimer();
  const left=remainingMs();
  if(left<=0)return false;
  if(unseen())return;
  timer=setTimer(()=>{
   timer=null;
   if(closed||!armed)return;
   sync();
   if(unseen())return;
   onExpired?.();
  },left);
 };
 const unwatch=watchPageVisibility(()=>{if(closed)return;sync();if(arm()===false)onExpired?.();},subscribe);
 return {remainingMs,start(expire){
  if(closed||armed)return;
  armed=true;onExpired=expire;
  if(arm()===false)expire();
 },release(){if(closed)return;closed=true;onExpired=null;stopTimer();unwatch();}};
}
export function boundedPreparation(work,{timeoutMs=30000,setTimer=setTimeout,clearTimer=clearTimeout,now=()=>performance.now(),hidden=pageIsHidden,subscribe}={}){
 if(typeof work!=='function')throw TypeError('Preparation requires a task');
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw TypeError('Invalid preparation deadline');
 return new Promise((resolve,reject)=>{
  const timeout=()=>Object.assign(Error('Flight preparation timed out'),{code:'PREPARATION_TIMEOUT'});
  const deadline=createVisibleDeadline({now,timeoutMs,hidden,subscribe,setTimer,clearTimer});
  let settled=false,task=null;
  const finish=(callback,value)=>{if(settled)return;settled=true;deadline.release();callback(value);};
  // Cancel the in-flight task on deadline so yielded loops stop scheduling.
  deadline.start(()=>{try{task?.cancel?.();}catch{}finish(reject,timeout());});
  Promise.resolve().then(()=>{task=work();return task;}).then(value=>deadline.remainingMs()<=0?finish(reject,timeout()):finish(resolve,value),error=>finish(reject,error));
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
export function createPreparationSequence({canceled=()=>false,now=()=>performance.now(),timeoutMs=30000,paint=yieldLoadingPaint,task=null,onStep=()=>{},Channel=globalThis.MessageChannel,setTimer=setTimeout,clearTimer=clearTimeout,fallbackMs=100,hidden=pageIsHidden,subscribe}={}){
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw TypeError('Invalid construction deadline');
 if(!Number.isFinite(fallbackMs)||fallbackMs<=0)throw TypeError('Invalid construction task fallback');
 if(task!==null&&typeof task!=='function')throw TypeError('Construction task must be a function');
 const deadline=createVisibleDeadline({now,timeoutMs,hidden,subscribe,setTimer,clearTimer});
 let busy=false,checkpointBusy=false,failure=null,channel=null,channelTried=false,pending=null,serial=0;
 const timeout=()=>Object.assign(Error('Flight construction timed out'),{code:'PREPARATION_TIMEOUT'});
 const cancelError=()=>Object.assign(Error('Flight construction was canceled'),{code:'PREPARATION_CANCELED'});
 const remainingMs=()=>deadline.remainingMs();
 const check=()=>{if(failure)throw failure;if(canceled())throw cancelError();if(remainingMs()<=0)throw timeout();};
 const closeChannel=()=>{const owned=channel;channel=null;if(owned){owned.port1.onmessage=null;owned.port1.close();owned.port2.close();}};
 const settle=(entry,error=null)=>{if(pending!==entry)return;pending=null;clearTimer(entry.timer);if(error)entry.reject(error);else entry.resolve();};
 const dispose=(error=cancelError())=>{failure ||= error;closeChannel();deadline.release();if(pending)settle(pending,failure);};
 function ensureChannel(){
  if(channelTried)return;channelTried=true;
  // One deadline owns the whole sequence, including idle gaps between steps.
  // It also closes ports if unrelated initialization throws between those steps.
  // Hidden-tab time is excluded; the timer is paused until the page is visible.
  deadline.start(()=>dispose(timeout()));
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
 const row=globalThis.document?.querySelector?.('.ammo-progress');
 if(row&&!row.children.length)for(const id of LOADING_ITEMS){const bullet=document.createElement('i');bullet.id='prep-'+id;row.append(bullet);}
 const done=completedLoadingItems(state,startupTrace.snapshot().events);
 for(const id of LOADING_ITEMS){const bullet=$('prep-'+id);if(bullet)bullet.dataset.complete=String(done.includes(id));}
 const node=$('loadStatus');if(!node)return;
 const text=state.status==='failed'?'Flight preparation could not finish. Please retry.':state.status==='ready'?'Ready for deployment':`${done.length} of ${LOADING_ITEMS.length} preparation items complete`;
 if(node.textContent!==text)node.textContent=text;
 node.classList.toggle('ready',state.status==='ready');node.classList.toggle('failed',state.status==='failed');
 $('loadingSystems')?.setAttribute('aria-busy',String(state.status==='preparing'));
 if(row)row.dataset.failed=String(state.status==='failed');
}
const loading=createLoadingController(renderLoading);
onStartupChange=()=>renderLoading(loading.snapshot());onStartupChange();
export const loadingSnapshot=()=>Object.freeze({...loading.snapshot(),trace:startupTrace.snapshot()});
export const loadingStage=id=>{const ok=loading.complete(id);if(ok)bootHeartbeat();return ok;};
export const loadingProgress=(id,detail)=>{const ok=loading.begin(id,detail);if(ok)bootHeartbeat();return ok;};
export const loadingReady=()=>loading.ready();
export const REPORT_BUILD='0.54.58';
const REPORT_ORIGINS=['https://gunner.satoshis.watch','http://127.0.0.1:8000'];
const missionBuild=$('missionBuild');
if(missionBuild)missionBuild.textContent='v'+REPORT_BUILD;
export function bootTimeoutEvidence(state,error){
 const progress=state?.progress,events=state?.trace?.events||[],last=events.at(-1);
 const elapsed=Number.isFinite(last?.at)?Math.round(last.at):null;
 const watchdog=error?.code==='STARTUP_TIMEOUT';
 return {lastPhase:watchdog?'startup-deadline':'preparation-deadline',lastCompletedPhase:progress?.stage??null,variant:state?.active??null,layer:null,jobIndex:null,totalJobs:null,batchIndex:null,jobBatchCount:null,submittedObjects:Number.isFinite(progress?.completed)?progress.completed:null,totalObjects:Number.isFinite(progress?.total)?progress.total:null,discoveredPrograms:null,finishedPrograms:null,pendingProgramIds:[],elapsedMs:elapsed,maxCompileMs:null,recentCompileMs:null,maxReadyPollMs:null,recentReadyPollMs:null,maxUniformsMs:null,recentUniformsMs:null,maxAttributesMs:null,recentAttributesMs:null,maxIntrospectMs:null,recentIntrospectMs:null,contextLost:null,parallelCompile:null,compilerNote:watchdog?'startup-stall-watchdog':'preparation-deadline',exceptionCode:String(error?.code||(watchdog?'STARTUP_TIMEOUT':'PREPARATION_TIMEOUT')).slice(0,80),exceptionMessage:String(error?.message||(watchdog?'Flight startup timed out':'Flight preparation timed out')).slice(0,160)};
}
const reportText=(value,limit)=>String(value??'').slice(0,limit);
export function buildLoadingFailureReport(state,{origin=globalThis.location?.origin,userAgent=globalThis.navigator?.userAgent,visibilityState=globalThis.document?.visibilityState}={}){
 if(state?.status!=='failed')return null;
 let safeOrigin='unavailable';try{safeOrigin=new URL(origin).origin;}catch{}
 const trace=state.trace||{events:[],dropped:0},events=trace.events.slice(0,96);
 const clipGraphicsSnapshot=value=>{
  if(!value||typeof value!=='object')return null;
  const number=name=>Number.isFinite(value[name])?value[name]:null,text=(name,limit)=>value[name]==null?null:reportText(value[name],limit);
  return {lastPhase:text('lastPhase',32),lastCompletedPhase:text('lastCompletedPhase',32),variant:text('variant',64),layer:number('layer'),jobIndex:number('jobIndex'),totalJobs:number('totalJobs'),batchIndex:number('batchIndex'),jobBatchCount:number('jobBatchCount'),submittedObjects:number('submittedObjects'),totalObjects:number('totalObjects'),discoveredPrograms:number('discoveredPrograms'),finishedPrograms:number('finishedPrograms'),pendingProgramIds:Array.isArray(value.pendingProgramIds)?value.pendingProgramIds.slice(0,24).map(id=>reportText(id,48)):[],elapsedMs:number('elapsedMs'),maxCompileMs:number('maxCompileMs'),recentCompileMs:number('recentCompileMs'),maxReadyPollMs:number('maxReadyPollMs'),recentReadyPollMs:number('recentReadyPollMs'),maxUniformsMs:number('maxUniformsMs'),recentUniformsMs:number('recentUniformsMs'),maxAttributesMs:number('maxAttributesMs'),recentAttributesMs:number('recentAttributesMs'),maxIntrospectMs:number('maxIntrospectMs'),recentIntrospectMs:number('recentIntrospectMs'),contextLost:typeof value.contextLost==='boolean'?value.contextLost:null,parallelCompile:typeof value.parallelCompile==='boolean'?value.parallelCompile:null,compilerNote:text('compilerNote',160),exceptionCode:text('exceptionCode',80),exceptionMessage:text('exceptionMessage',160)};
 };
 const loading={status:state.status,active:state.active,completed:[...state.completed],progress:state.progress?{stage:state.progress.stage,completed:state.progress.completed,total:state.progress.total,...(state.progress.label?{label:reportText(state.progress.label,80)}:{}),...(state.progress.preTimeoutSnapshot?{preTimeoutSnapshot:clipGraphicsSnapshot(state.progress.preTimeoutSnapshot)}:{})}:null,error:state.error?{code:reportText(state.error.code,80),message:reportText(state.error.message,2048)}:null,trace:{events:events.map(e=>({name:reportText(e.name,80),state:reportText(e.state,24),at:e.at,...(e.outcome===undefined?{}:{outcome:reportText(e.outcome,40)})})),dropped:trace.dropped+Math.max(0,trace.events.length-96)}};
 return JSON.stringify({build:REPORT_BUILD,origin:reportText(safeOrigin,256),userAgent:reportText(userAgent,512),visibilityAtFailure:['visible','hidden'].includes(visibilityState)?visibilityState:'unavailable',loading},null,2);
}
let copyLoadingReportBound=false;
function showLoadingFailureDetails(state){
 if(!REPORT_ORIGINS.includes(globalThis.location?.origin)||state.status!=='failed')return;
 const section=$('loadingFailureDetails'),detail=$('loadingFailureDetail'),button=$('copyLoadingReport'),disclosure=$('loadingReportDisclosure'),text=$('loadingReport'),status=$('loadingReportCopyStatus');
 if(!section||!detail||!button||!disclosure||!text||!status)return;
 const stage=state.active==='scene'&&state.progress?.label?state.progress.label:activity[state.active]||'Preparing the flight';
 const timedOut=state.error?.code==='PREPARATION_TIMEOUT'||state.error?.code==='STARTUP_TIMEOUT',contextLost=state.error?.code==='PREPARATION_CANCELED'&&state.error?.message==='Graphics were lost during loading',manuallyReported=state.error?.code==='PLAYER_REPORTED_FAILURE';
 detail.textContent=manuallyReported?'A tester reported that loading did not finish.':timedOut?'Loading timed out while '+stage.charAt(0).toLowerCase()+stage.slice(1)+'.':contextLost?'Graphics were lost while preparing the flight.':stage+' stopped before it could finish.';
 text.value=buildLoadingFailureReport(state);text.readOnly=true;section.hidden=false;
 const reportButton=$('reportFailedLoad');if(reportButton)reportButton.setAttribute('aria-expanded','true');
 $('intro')?.classList?.toggle('load-failed',true);
 const stack=section.closest?.('.deployment-action')||$('reportFailedLoad')||$('startButton')||section;
 try{stack.scrollIntoView({block:'nearest',inline:'nearest'});}catch{}
 if(copyLoadingReportBound)return;
 copyLoadingReportBound=true;
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
export function reportFailedLoad(){
 const current=loadingSnapshot();
 const reported=Object.freeze({...current,status:'failed',error:Object.freeze({code:'PLAYER_REPORTED_FAILURE',message:'Tester reported that loading did not finish'})});
 showLoadingFailureDetails(reported);
 return reported;
}
$('reportFailedLoad')?.addEventListener('click',reportFailedLoad);
$('qaStuckLoad')?.addEventListener('click',reportFailedLoad);
export function loadingFailure(error,{reload=()=>globalThis.location.reload()}={}){
 if(loading.snapshot().status==='failed')return;
 const current=loadingSnapshot();
 if((error?.code==='STARTUP_TIMEOUT'||error?.code==='PREPARATION_TIMEOUT')&&!current.progress?.preTimeoutSnapshot){
  const evidence=error?.preTimeoutSnapshot&&typeof error.preTimeoutSnapshot==='object'?error.preTimeoutSnapshot:bootTimeoutEvidence(current,error);
  const active=current.active&&activity[current.active]?current.active:'assets';
  loading.begin(active,{stage:current.progress?.stage||'timed-out',completed:current.progress?.completed??0,total:current.progress?.total??0,...(typeof current.progress?.label==='string'?{label:current.progress.label}:{}),preTimeoutSnapshot:evidence});
 }
 startupMark('startup','failed',error?.code||'PREPARATION_FAILED');
 const settings=$('settingsButton');if(settings)settings.disabled=true;
 loading.fail(error);
 showLoadingFailureDetails(loadingSnapshot());
 const button=$('startButton');if(button){const retry=button.cloneNode(true);retry.disabled=false;retry.textContent='RETRY LOADING';retry.addEventListener('click',()=>{retry.disabled=true;reload();},{once:true});const focused=globalThis.document.activeElement===button;button.replaceWith(retry);if(focused)retry.focus();}
 const intro=$('intro');if(intro){intro.hidden=false;intro.classList?.toggle('load-failed',true);}
 for(const id of ['unsupported','pause','opening','ending','result']){const overlay=$(id);if(overlay)overlay.hidden=true;}
 $('hud')?.classList.remove('visible');
}
if(typeof window!=='undefined')Object.defineProperty(window,'__GUNNER_LOADING__',{get:loadingSnapshot,configurable:false});
let guideModelProvider=null,guideViewer=null,guideViewerPromise=null;
export function setGuideModelProvider(provider){guideModelProvider=provider;if($('fieldGuide')?.open)void openGuideViewer();}
export const guideViewerStats=()=>guideViewer?.stats()||{models:[],contexts:0};
async function openGuideViewer(button=null){
 if(!guideViewerPromise)guideViewerPromise=import('./field-guide-viewer.js').then(({createFieldGuideViewer})=>guideViewer=createFieldGuideViewer({dialog:$('fieldGuide'),provider:()=>guideModelProvider})).catch(error=>{guideViewerPromise=null;throw error;});
 try{await guideViewerPromise;if($('fieldGuide')?.open){if(button)guideViewer.show(button);await guideViewer.prepare();}}catch{ /* Existing image identification remains available; retry on next open. */ }
}
export const FIELD_GUIDE=Object.freeze([
 ['eggs','Brood eggs','THE OBJECTIVE','Membranous eggs cluster in nests and in the ruins.','Shoot the eggs directly. Each rupture adds to your score; clear clusters with the heavy cannon.'],
 ['creepers','Creepers','MUD THROWERS','Cracked-basalt gorillas with molten veins, a pale bone face mask and glowing eyes. They knuckle-walk the banks and climb the cliffs. Their mud coats the glass.','Hit them during the throwing windup to interrupt. Keep the guns on one while tracking the next threat.'],
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
  const mark=document.createElement('button');mark.type='button';mark.className='guide-portrait guide-model-trigger '+id;mark.setAttribute('aria-label','Enlarge '+name);mark.setAttribute('aria-haspopup','dialog');mark.setAttribute('aria-expanded','false');
  const portrait=document.createElement('img');portrait.dataset.src='./assets/field-guide/'+id+(id==='tanks'?'.jpg':'.png')+'?v=054-58';portrait.alt=id==='queen'?"The Queen's silhouette; her appearance remains unknown":name+' — model identification';portrait.width=512;portrait.height=384;portrait.decoding='async';mark.append(portrait);const enlarge=document.createElement('span');enlarge.className='guide-enlarge';enlarge.textContent=id==='dragons'||id==='queen'?'ENLARGE ↗':'VIEW 3D ↗';mark.append(enlarge);
  const copy=document.createElement('div');
  for(const [tagName,text,cls]of [['span',tag,'guide-tag'],['h3',name,''],['h4','COUNTERPLAY',''],['p',counter,'guide-counter']]){const node=document.createElement(tagName);node.textContent=text;if(cls)node.className=cls;copy.append(node);}
  const details=document.createElement('details');details.className='guide-details';
  const summary=document.createElement('summary');summary.textContent='Dossier details';
  const descriptionNode=document.createElement('p');descriptionNode.textContent=description;
  details.append(summary,descriptionNode);copy.append(details);
  card.append(mark,copy);grid.append(card);
 }
 function close(){dialog.close();}
 trigger.addEventListener('click',()=>{for(const img of dialog.querySelectorAll('img[data-src]')){if(!img.src)img.src=img.dataset.src;}dialog.showModal();trigger.setAttribute('aria-expanded','true');$('closeGuide').focus();void openGuideViewer();});
 dialog.addEventListener('click',e=>{const button=e.target.closest?.('.guide-model-trigger');if(button)void openGuideViewer(button);});
 $('closeGuide').addEventListener('click',close);
 dialog.addEventListener('click',e=>{const b=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom))close();});
 dialog.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');trigger.focus();});
 dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Tab'){const nodes=[...dialog.querySelectorAll('button,a[href],summary,[tabindex="0"]')];const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
}
