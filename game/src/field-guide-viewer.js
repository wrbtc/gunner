import * as THREE from '../vendor/three.module.js?v=052';
const MODEL_IDS=['eggs','creepers','dancers','rimmers','tanks','plasma','dragons'];
const MIN_ZOOM=.6,MAX_ZOOM=3,ZOOM_STEP=1.25,MAX_PAN_Y=.65;
export const clampGuideZoom=value=>THREE.MathUtils.clamp(value,MIN_ZOOM,MAX_ZOOM);
export const clampGuidePan=value=>THREE.MathUtils.clamp(value,-MAX_PAN_Y,MAX_PAN_Y);
// One lazy context for all thumbnails and the selected interactive model.
export function createFieldGuideViewer({dialog,provider,modelIds=MODEL_IDS}){
 const detail=document.createElement('dialog');detail.id='guideModelDialog';detail.setAttribute('aria-labelledby','guideModelTitle');
 detail.innerHTML='<header><h2 id="guideModelTitle"></h2><button type="button" class="guide-model-close">CLOSE ×</button></header><div class="guide-model-stage"></div><div class="guide-model-tools"><button type="button" data-turn="-1" aria-label="Rotate model left">↶</button><span>DRAG: TURN / MOVE</span><button type="button" data-turn="1" aria-label="Rotate model right">↷</button><span class="guide-model-zoom" role="group" aria-label="Model zoom"><span aria-hidden="true">ZOOM</span><button type="button" data-zoom="-1" aria-label="Zoom out">−</button><output data-zoom-value>100%</output><button type="button" data-zoom="1" aria-label="Zoom in">+</button></span><button type="button" data-reset>RESET VIEW</button><label data-specimen-label hidden>SPECIMEN <select data-specimen><option value="eggs">Intact egg</option><option value="egg-maggot">Larva</option><option value="egg-shell">Shell</option></select></label><label data-motion-label hidden>MOTION <select data-motion></select></label><button type="button" data-pause hidden>PAUSE MOTION</button></div><p class="guide-model-status" role="status"></p>';
 document.body.append(detail);const stage=detail.querySelector('.guide-model-stage'),title=detail.querySelector('h2'),status=detail.querySelector('[role=status]'),controls=detail.querySelector('.guide-model-tools'),close=detail.querySelector('.guide-model-close'),zoomValue=detail.querySelector('[data-zoom-value]');
 let renderer=null,scene=null,camera=null,current=null,trigger=null,generation=0,frame=0,tickRaf=0,lastTick=0,drag=null,error=null,building=false;
 const specimen=detail.querySelector('[data-specimen]'),specimenLabel=detail.querySelector('[data-specimen-label]'),motion=detail.querySelector('[data-motion]'),motionLabel=detail.querySelector('[data-motion-label]'),pause=detail.querySelector('[data-pause]'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let selection=0,contextLost=false,disposed=false,motionPaused=reduced.matches;
 const models=new Map(),thumbs=new Map();let draws=0;
 function ensureRenderer(){if(renderer)return;renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(1);renderer.setSize(420,330);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;renderer.setClearColor(0x121b17);renderer.domElement.setAttribute('aria-label','3D creature model. Drag horizontally to turn or vertically to move; scroll or use plus and minus to zoom.');renderer.domElement.tabIndex=0;renderer.domElement.style.touchAction='none';
 scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xd4e9e4,0x505546,2.1));const key=new THREE.DirectionalLight(0xffedd2,3.8);key.position.set(3,4,5);scene.add(key);const rim=new THREE.DirectionalLight(0x94c6ce,3);rim.position.set(-3,2,-3);scene.add(rim);camera=new THREE.PerspectiveCamera(40,420/330,.01,30);camera.position.set(0,.45,4.2);camera.lookAt(0,0,0);
 const canvas=renderer.domElement;canvas.addEventListener('pointerdown',e=>{if(!current)return;drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag||!current)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;current.root.rotation.y+=dx*.012;current.panY=clampGuidePan((current.panY||0)+dy/Math.max(1,stage.clientHeight));drag={x:e.clientX,y:e.clientY};schedule();});const end=()=>{drag=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
 canvas.addEventListener('wheel',e=>{if(!current)return;e.preventDefault();setZoom((current.zoom||1)*Math.exp(-e.deltaY*.0015));},{passive:false});
 canvas.addEventListener('keydown',e=>{if(!current||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','+','=','-','_'].includes(e.key))return;e.preventDefault();if(e.key==='Home')reset();else if(e.key==='+'||e.key==='=')setZoom((current.zoom||1)*ZOOM_STEP);else if(e.key==='-'||e.key==='_')setZoom((current.zoom||1)/ZOOM_STEP);else{if(e.key==='ArrowLeft'||e.key==='ArrowRight')current.root.rotation.y+=(e.key==='ArrowLeft'?-1:1)*.2;else current.root.rotation.x=THREE.MathUtils.clamp(current.root.rotation.x+(e.key==='ArrowUp'?-1:1)*.12,-.65,.65);schedule();}});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(renderer?.domElement!==canvas)return;contextLost=true;stopTick();if(frame){cancelAnimationFrame(frame);frame=0;}error='3D view unavailable. Close and reopen the guide to retry.';status.textContent=error;});
 }
 function renderModel(model,width,height){ensureRenderer();renderer.setSize(width,height);camera.aspect=width/height;camera.zoom=clampGuideZoom(model.zoom||1);const vertical=THREE.MathUtils.degToRad(camera.fov),fov=Math.min(vertical,2*Math.atan(Math.tan(vertical/2)*camera.aspect)),distance=(model.viewRadius||1.65)/Math.sin(fov/2),panY=clampGuidePan(model.panY||0)*2*distance*Math.tan(vertical/2)/camera.zoom;camera.position.set(0,distance*.105+panY,distance);camera.lookAt(0,panY,0);camera.updateProjectionMatrix();scene.add(model.root);renderer.render(scene,camera);scene.remove(model.root);draws++;}
 function draw(){frame=0;if(!detail.open||!current||!renderer||contextLost)return;const b=stage.getBoundingClientRect();renderModel(current,Math.max(1,Math.min(1000,Math.round(b.width))),Math.max(1,Math.min(700,Math.round(b.height))));}
 function schedule(){if(!disposed&&detail.open&&current&&!frame&&!tickRaf&&!contextLost)frame=requestAnimationFrame(draw);}
 function syncMotion(){motionLabel.hidden=!current?.clips?.length;pause.hidden=!current?.tick;motion.replaceChildren(...(current?.clips||[]).map(clip=>{const option=document.createElement('option');option.value=clip.name;option.textContent=clip.label;return option;}));if(current?.activeClip)motion.value=current.activeClip;pause.textContent=motionPaused?'PLAY MOTION':'PAUSE MOTION';pause.setAttribute('aria-pressed',String(motionPaused));}
 motion.addEventListener('change',()=>{current?.playClip?.(motion.value);schedule();});
 pause.addEventListener('click',()=>{motionPaused=!motionPaused;syncMotion();if(motionPaused){stopTick();schedule();}else startTick();});
 function stopTick(){if(tickRaf)cancelAnimationFrame(tickRaf);tickRaf=0;lastTick=0;}
 function startTick(){
  if(disposed||tickRaf||typeof current?.tick!=='function'||motionPaused||document.hidden||contextLost){schedule();return;}
  if(frame){cancelAnimationFrame(frame);frame=0;}
  lastTick=0;
  const loop=now=>{
   tickRaf=0;
   if(disposed||!detail.open||!current||typeof current.tick!=='function'||document.hidden||motionPaused||contextLost)return;
   const dt=Math.min(0.05,lastTick?(now-lastTick)/1000:0);
   lastTick=now;
   current.tick(dt);
   draw();
   tickRaf=requestAnimationFrame(loop);
  };
  tickRaf=requestAnimationFrame(loop);
 }
 function syncZoom(){const value=Math.round((current?.zoom||1)*100)+'%';zoomValue.value=value;zoomValue.textContent=value;}
 function setZoom(value){if(!current)return;current.zoom=clampGuideZoom(value);syncZoom();schedule();}
 function reset(){if(!current)return;current.root.rotation.set(0,current.initialY,0);current.zoom=1;current.panY=0;syncZoom();if(tickRaf)return;schedule();}
 async function prepare(){
  if(disposed||building||!dialog.open||modelIds.every(id=>models.has(id)))return;const make=provider();if(!make)return;building=true;const token=generation;
  try{ensureRenderer();for(const id of modelIds){if(models.has(id))continue;if(!dialog.open||token!==generation)break;let model;try{model=await make(id);}catch(e){if(id!=='dragons')throw e;error=String(e.message||e);continue;}if(!dialog.open||token!==generation){model.dispose();break;}model.initialY=model.root.rotation.y;model.zoom=1;model.panY=0;models.set(id,model);renderModel(model,420,330);const url=renderer.domElement.toDataURL('image/png');thumbs.set(id,url);const img=dialog.querySelector(`[data-creature="${id}"] img`);if(img){img.src=url;img.removeAttribute('data-guide-pending');img.dataset.modelReady='true';img.alt=id+' — 3D model preview';}await new Promise(resolve=>setTimeout(resolve,0));}
  }catch(e){error=String(e.message||e);status.textContent='3D view could not load. Close and reopen the guide to retry.';}
  finally{building=false;if(!disposed&&token!==generation&&dialog.open)queueMicrotask(prepare);else if(!disposed&&token===generation&&detail.open&&trigger)show(trigger);}
 }
 function show(button){if(disposed)return;selection++;if(trigger&&trigger!==button)trigger.setAttribute('aria-expanded','false');trigger=button;const card=button.closest('[data-creature]'),id=card.dataset.creature;title.textContent=card.querySelector('h3').textContent;specimenLabel.hidden=id!=='eggs';specimen.value='eggs';stopTick();current=building?null:models.get(id)||null;stage.replaceChildren();status.textContent='';controls.hidden=!current;
  syncMotion();syncZoom();
  if(current)stage.append(renderer.domElement);
  else{const source=card.querySelector('img');if(source?.currentSrc&&source.dataset.modelReady==='true'){const img=document.createElement('img');img.src=source.currentSrc;img.alt=title.textContent;stage.append(img);}if(MODEL_IDS.includes(id))status.textContent=error?'3D view unavailable. Close and reopen the guide to retry.':'3D model is preparing…';}
  if(!detail.open)detail.showModal();button.setAttribute('aria-expanded','true');close.focus();
  if(current){if(typeof current.tick==='function')startTick();else schedule();}
 }
 async function chooseSpecimen(){
  if(disposed)return;
  const id=specimen.value,token=++selection,epoch=generation;stopTick();current=null;controls.hidden=false;motionLabel.hidden=pause.hidden=true;stage.replaceChildren();status.textContent='Loading specimen…';
  let created=null;
  try{
   let model=models.get(id);
   if(!model){const make=provider();if(!make)throw Error('Field Notes is not ready');created=await make(id);model=created;}
   if(token!==selection||epoch!==generation||!detail.open||!dialog.open){created?.dispose();return;}
   if(created){created.initialY=created.root.rotation.y;created.zoom=1;created.panY=0;models.set(id,created);}
   current=model;error=null;title.textContent=id==='egg-maggot'?'Egg larva':id==='egg-shell'?'Egg shell':trigger.closest('[data-creature]').querySelector('h3').textContent;status.textContent='';stage.append(renderer.domElement);syncMotion();syncZoom();startTick();
  }catch(e){created?.dispose();if(token===selection&&epoch===generation&&detail.open){status.textContent='Specimen could not load. Choose it again to retry.';error=String(e.message||e);}}
 }
 specimen.addEventListener('change',chooseSpecimen);
 const onVisibility=()=>{if(document.hidden)stopTick();else if(detail.open)startTick();};document.addEventListener('visibilitychange',onVisibility);
 const onReduced=()=>{motionPaused=reduced.matches;syncMotion();stopTick();if(detail.open)startTick();};reduced.addEventListener('change',onReduced);
 close.addEventListener('click',()=>detail.close());detail.addEventListener('click',e=>{if(e.target!==detail)return;const b=detail.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)detail.close();});
 detail.addEventListener('close',()=>{selection++;stopTick();if(frame)cancelAnimationFrame(frame);frame=0;drag=null;current=null;stage.replaceChildren();trigger?.setAttribute('aria-expanded','false');if(dialog.open)trigger?.focus();});
 detail.addEventListener('keydown',e=>{e.stopPropagation();if(e.key!=='Tab')return;const nodes=[...detail.querySelectorAll('button,select,canvas[tabindex]')].filter(n=>!n.closest('[hidden]'));if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}});
 controls.addEventListener('click',e=>{if(!current)return;if(e.target.closest('[data-reset]'))reset();else{const zoomButton=e.target.closest('[data-zoom]');if(zoomButton)setZoom((current.zoom||1)*(Number(zoomButton.dataset.zoom)>0?ZOOM_STEP:1/ZOOM_STEP));else{const button=e.target.closest('[data-turn]');if(button){current.root.rotation.y+=Number(button.dataset.turn)*.35;schedule();}}}});
 const resize=new ResizeObserver(()=>schedule());resize.observe(stage);
 function release(){generation++;selection++;if(detail.open)detail.close();stopTick();if(frame)cancelAnimationFrame(frame);frame=0;drag=current=null;for(const model of models.values())model.dispose();models.clear();thumbs.clear();if(renderer){const old=renderer;renderer=null;old.dispose();old.forceContextLoss();old.domElement.remove();}scene=camera=null;error=null;contextLost=false;}
 dialog.addEventListener('close',release);
 return{prepare,show,stats:()=>({models:[...models.keys()],draws,contexts:renderer?1:0,expanded:detail.open,current:current?.root.name||null,rotation:current?.root.rotation.toArray()||null,zoom:current?.zoom||null,panY:current?.panY||0,error,building,disposed,animating:!!tickRaf,motionPaused,activeClip:current?.activeClip||null}),dispose(){if(disposed)return;disposed=true;release();document.removeEventListener('visibilitychange',onVisibility);reduced.removeEventListener('change',onReduced);resize.disconnect();dialog.removeEventListener('close',release);detail.remove();}};
}
