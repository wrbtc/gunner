import * as THREE from '../vendor/three.module.js?v=052';
const MODEL_IDS=['eggs','creepers','dancers','rimmers','tanks','plasma'];
// One lazy context for all thumbnails and the selected interactive model.
export function createFieldGuideViewer({dialog,provider}){
 const detail=document.createElement('dialog');detail.id='guideModelDialog';detail.setAttribute('aria-labelledby','guideModelTitle');
 detail.innerHTML='<header><h2 id="guideModelTitle"></h2><button type="button" class="guide-model-close">CLOSE ×</button></header><div class="guide-model-stage"></div><div class="guide-model-tools"><button type="button" data-turn="-1" aria-label="Rotate model left">↶</button><span>DRAG TO ROTATE</span><button type="button" data-turn="1" aria-label="Rotate model right">↷</button><button type="button" data-reset>RESET VIEW</button></div><p class="guide-model-status" role="status"></p>';
 document.body.append(detail);const stage=detail.querySelector('.guide-model-stage'),title=detail.querySelector('h2'),status=detail.querySelector('[role=status]'),controls=detail.querySelector('.guide-model-tools'),close=detail.querySelector('.guide-model-close');
 let renderer=null,scene=null,camera=null,current=null,trigger=null,generation=0,frame=0,drag=null,error=null,building=false;
 const models=new Map(),thumbs=new Map();let draws=0;
 function ensureRenderer(){if(renderer)return;renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(1);renderer.setSize(420,330);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;renderer.setClearColor(0x121b17);renderer.domElement.setAttribute('aria-label','3D creature model. Drag or use left and right arrow keys to rotate.');renderer.domElement.tabIndex=0;renderer.domElement.style.touchAction='none';
 scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xd4e9e4,0x505546,2.1));const key=new THREE.DirectionalLight(0xffedd2,3.8);key.position.set(3,4,5);scene.add(key);const rim=new THREE.DirectionalLight(0x94c6ce,3);rim.position.set(-3,2,-3);scene.add(rim);camera=new THREE.PerspectiveCamera(40,420/330,.01,30);camera.position.set(0,.45,4.2);camera.lookAt(0,0,0);
 const canvas=renderer.domElement;canvas.addEventListener('pointerdown',e=>{if(!current)return;drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag||!current)return;current.root.rotation.y+=(e.clientX-drag.x)*.012;current.root.rotation.x=THREE.MathUtils.clamp(current.root.rotation.x+(e.clientY-drag.y)*.008,-.65,.65);drag={x:e.clientX,y:e.clientY};schedule();});const end=()=>{drag=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
 canvas.addEventListener('keydown',e=>{if(!current||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home')reset();else{if(e.key==='ArrowLeft'||e.key==='ArrowRight')current.root.rotation.y+=(e.key==='ArrowLeft'?-1:1)*.2;else current.root.rotation.x=THREE.MathUtils.clamp(current.root.rotation.x+(e.key==='ArrowUp'?-1:1)*.12,-.65,.65);schedule();}});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(renderer?.domElement!==canvas)return;error='3D view unavailable. Close and reopen the guide to retry.';status.textContent=error;});
 }
 function renderModel(model,width,height){ensureRenderer();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();scene.add(model.root);renderer.render(scene,camera);scene.remove(model.root);draws++;}
 function draw(){frame=0;if(!detail.open||!current||!renderer)return;const b=stage.getBoundingClientRect();renderModel(current,Math.max(1,Math.min(1000,Math.round(b.width))),Math.max(1,Math.min(700,Math.round(b.height))));}
 function schedule(){if(detail.open&&current&&!frame)frame=requestAnimationFrame(draw);}
 function reset(){if(!current)return;current.root.rotation.set(0,current.initialY,0);schedule();}
 async function prepare(){
  if(building||!dialog.open||models.size===MODEL_IDS.length)return;const make=provider();if(!make)return;building=true;const token=generation;
  try{ensureRenderer();for(const id of MODEL_IDS){if(models.has(id))continue;if(!dialog.open||token!==generation)break;const model=await make(id);if(!dialog.open||token!==generation){model.dispose();break;}model.initialY=model.root.rotation.y;models.set(id,model);renderModel(model,420,330);const url=renderer.domElement.toDataURL('image/png');thumbs.set(id,url);const img=dialog.querySelector(`[data-creature="${id}"] img`);img.src=url;img.dataset.modelReady='true';img.alt=id+' — 3D model preview';await new Promise(resolve=>setTimeout(resolve,0));}
  }catch(e){error=String(e.message||e);status.textContent='3D view could not load. Close and reopen the guide to retry.';}
  finally{building=false;if(token!==generation&&dialog.open)queueMicrotask(prepare);else if(token===generation&&detail.open&&trigger)show(trigger);}
 }
 function show(button){trigger=button;const card=button.closest('[data-creature]'),id=card.dataset.creature;title.textContent=card.querySelector('h3').textContent;current=building?null:models.get(id)||null;stage.replaceChildren();status.textContent='';controls.hidden=!current;
  if(current){stage.append(renderer.domElement);schedule();}
  else{const img=document.createElement('img');img.src=card.querySelector('img').src;img.alt=title.textContent;stage.append(img);if(MODEL_IDS.includes(id))status.textContent=error?'3D view unavailable. Close and reopen the guide to retry.':'3D model is preparing…';}
  if(!detail.open)detail.showModal();button.setAttribute('aria-expanded','true');close.focus();if(current)schedule();
 }
 close.addEventListener('click',()=>detail.close());detail.addEventListener('click',e=>{if(e.target!==detail)return;const b=detail.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)detail.close();});
 detail.addEventListener('close',()=>{if(frame)cancelAnimationFrame(frame);frame=0;drag=null;current=null;stage.replaceChildren();trigger?.setAttribute('aria-expanded','false');if(dialog.open)trigger?.focus();});
 detail.addEventListener('keydown',e=>{e.stopPropagation();if(e.key!=='Tab')return;const nodes=[...detail.querySelectorAll('button,canvas[tabindex]')].filter(n=>!n.closest('[hidden]'));if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}});
 controls.addEventListener('click',e=>{if(!current)return;if(e.target.closest('[data-reset]'))reset();else{const button=e.target.closest('[data-turn]');if(button){current.root.rotation.y+=Number(button.dataset.turn)*.35;schedule();}}});
 const resize=new ResizeObserver(()=>schedule());resize.observe(stage);
 function release(){generation++;if(detail.open)detail.close();if(frame)cancelAnimationFrame(frame);frame=0;drag=current=null;for(const model of models.values())model.dispose();models.clear();thumbs.clear();if(renderer){const old=renderer;renderer=null;old.dispose();old.forceContextLoss();old.domElement.remove();}scene=camera=null;error=null;}
 dialog.addEventListener('close',release);
 return{prepare,show,stats:()=>({models:[...models.keys()],draws,contexts:renderer?1:0,expanded:detail.open,current:current?.root.name||null,rotation:current?.root.rotation.toArray()||null,error,building}),dispose(){release();resize.disconnect();dialog.removeEventListener('close',release);detail.remove();}};
}
