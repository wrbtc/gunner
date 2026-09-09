import {createQueenAttackOrder} from './queen-attack-order.js?v=052';
import * as T from '../vendor/three.module.js?v=052';
import {createQueenModel,QUEEN_POSITION,QUEEN_ARM_HP} from './queen-model.js?v=052';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=T.MathUtils.clamp,smooth=T.MathUtils.smoothstep;
export const QUEEN_RULES=Object.freeze({quietAt:.825,introAt:.84,hoverAt:.89,introSeconds:14,deathSeconds:8,reloadSeconds:2.2,firstTellSeconds:2,armTellSeconds:.95,recoverySeconds:.3,interruptRecoverySeconds:.15,randomArmOrder:true,randomAmmoOrder:true,armPoints:4000,defeatPoints:20000});
export function createQueenEncounter({scene,camera,craft,game,centerAt,widthAt,bankMeshes,eggNests,hud,playerFov,reduced,launch,burst,clearCombat,award,aimAt,onCleared,audio,logEvent,hitFeedback}){
 const model=createQueenModel({scene,centerAt,widthAt,bankMeshes}),arms=model.arms,eggs=eggNests.addQueenBrood(model.eggSites),ray=new T.Raycaster();
 const ui=document.createElement('div');ui.id='queenHUD';ui.hidden=true;ui.innerHTML='<div class="queen-title">THE QUEEN <span class="queen-count"></span></div><div class="queen-health"><span></span></div><div class="queen-arms"></div><div class="queen-state"></div>';hud.appendChild(ui);
 const bars=arms.map((a,i)=>{const e=document.createElement('span');e.className='queen-arm-bar';e.textContent=String(i+1);ui.querySelector('.queen-arms').appendChild(e);return e;});
 const cinema=document.createElement('div');cinema.id='queenCinema';cinema.hidden=true;cinema.innerHTML='<div class="queen-letterbox top"></div><div class="queen-cinema-copy"><span></span><strong></strong></div><div class="queen-letterbox bottom"></div>';document.body.appendChild(cinema);
 let phase='dormant',age=0,clock=0,cycle=0,armIndex=0,orderIndex=0,shotIndex=0,timer=0,reloading=false,parent=null,savedFov=66,departAge=0,beat='windup',tellDuration=QUEEN_RULES.firstTellSeconds,seenIntro=false;const events=[];
 const startEye=V(),startQuat=new T.Quaternion(),eye=V(),target=V(),look=new T.Matrix4(),viewQuat=new T.Quaternion(),endEye=V(),endQuat=new T.Quaternion();
 const attackOrder=createQueenAttackOrder();
 const currentArm=()=>arms[armIndex];const alive=()=>arms.filter(a=>!a.dead);const rawProgress=()=>game.flightStart+(1-game.flightStart)*clamp((game.time-(game.flightDelay||0))/88,0,1);
 function event(type,data={}){const e={time:clock,phase,...data,type};events.push(e);if(events.length>1200)events.shift();logEvent?.('queen-'+type,data);}
 function setPhase(next){phase=next;age=0;event('phase',{phase:next});}
 function startMovie(next){clearCombat();game.gunHeld=false;game.rearState='normal';parent=camera.parent;savedFov=playerFov();camera.updateWorldMatrix(true,false);camera.getWorldPosition(startEye);camera.getWorldQuaternion(startQuat);aimAt(centerAt(QUEEN_POSITION).setY(45));scene.attach(camera);setPhase(next);cinema.hidden=false;hud.classList.add('queen-movie');}
 function restoreCamera(){if(parent){parent.add(camera);camera.position.set(0,0,0);camera.quaternion.identity();parent=null;}camera.fov=playerFov();camera.near=.06;camera.updateProjectionMatrix();cinema.hidden=true;hud.classList.remove('queen-movie');}
 function selectArm(from){
  const living=alive().map(a=>a.index);if(from===0)attackOrder.beginRound(living);
  const next=attackOrder.next(living);orderIndex=next?from:8;armIndex=next?next.arm:8;shotIndex=next?['mud','spike','bomb'].indexOf(next.type):0;
 }
 function warnArm(){beat='windup';timer=tellDuration=QUEEN_RULES.armTellSeconds;event('arm-warning',{arm:armIndex+1,seconds:timer,projectile:['mud','spike','bomb'][shotIndex]});}
 function beginCombat(){for(const e of eggs){e.laid=true;e.group.scale.setScalar(1);}restoreCamera();setPhase('combat');cycle=1;selectArm(0);timer=QUEEN_RULES.firstTellSeconds;tellDuration=timer;beat='windup';reloading=false;seenIntro=true;for(const a of arms)a.state='ready';event('combat-start',{arms:8,reloadSeconds:QUEEN_RULES.reloadSeconds,firstTellSeconds:timer});}
 function finish(){restoreCamera();onCleared(QUEEN_RULES.hoverAt);setPhase('cleared');departAge=0;ui.hidden=true;award(QUEEN_RULES.defeatPoints,'queen');audio.creature('queen',model.root.position,true);event('defeated',{points:QUEEN_RULES.defeatPoints});}
 function flightProgress(p){if(phase==='intro')return T.MathUtils.lerp(QUEEN_RULES.introAt,QUEEN_RULES.hoverAt,smooth(age,0,7));if(phase==='combat'||phase==='death')return QUEEN_RULES.hoverAt;return p;}
 function speedScale(){if(phase==='combat'||phase==='death')return 0;if(phase==='intro'){const t=clamp(age/7,0,1);return (QUEEN_RULES.hoverAt-QUEEN_RULES.introAt)*6*t*(1-t)/7/(.935/88);}return 1;}
 function update(dt,time){clock=time;if(game.title||game.opening||game.ended)return;const p=rawProgress();
  if(phase==='dormant'&&p>=QUEEN_RULES.quietAt){setPhase('calm');clearCombat();game.gunHeld=false;event('weapons-locked');}
  if(phase==='calm'&&p>=QUEEN_RULES.introAt)startMovie('intro');age+=dt;
  if(phase==='intro'){
   for(let i=0;i<eggs.length;i++)if(!eggs[i].laid&&age>=2.1+i*.72){eggs[i].laid=true;event('egg-laid',{arm:i+1,egg:eggs[i].id});}
   if(age+1e-8>=QUEEN_RULES.introSeconds)beginCombat();
  }else if(phase==='combat'){
   if(!alive().length){startMovie('death');return;}
   // Random living-arm order and an independent ammunition bag. Preserve
   // one telegraphed shot at a time; destroyed arms cannot fire or monopolize order.
   if(!reloading&&beat!=='recovery'&&currentArm()?.dead){beat='recovery';timer=QUEEN_RULES.interruptRecoverySeconds;event('volley-interrupted',{arm:armIndex+1});}
   timer-=dt;if(timer<=0){
    if(reloading){reloading=false;cycle++;selectArm(0);warnArm();event('reload-complete',{cycle});}
    else if(beat==='recovery'){
     selectArm(orderIndex+1);
     if(orderIndex>=8){reloading=true;timer=QUEEN_RULES.reloadSeconds;event('reload-start',{seconds:timer,cycle});}
     else warnArm();
    }else{
     const a=currentArm(),type=['mud','spike','bomb'][shotIndex];
     if(a&&launch(a,type)){event('shot',{arm:armIndex+1,projectile:type,cycle});beat='recovery';timer=QUEEN_RULES.recoverySeconds;}
     else timer=.05; // A full projectile pool delays this shot; never batch a catch-up burst.
    }
   }
  }else if(phase==='death'){if(age+1e-8>=QUEEN_RULES.deathSeconds)finish();}
  else if(phase==='cleared')departAge+=dt;
 }
 function present(){const active=phase!=='dormant'&&phase!=='cleared'&&!game.ended;model.root.visible=!game.title&&!game.opening&&!game.ended&&phase!=='cleared'&&rawProgress()>.80;
  for(const [i,e]of eggs.entries())e.group.scale.setScalar(phase==='intro'?Math.max(.001,smooth(age,2.1+i*.72,2.65+i*.72)):1);
  const attention=phase==='combat'||phase==='death'?1:phase==='intro'?smooth(age,7.9,11.8):0,collapse=phase==='death'?smooth(age,1,6.6):0;
  if(model.root.visible)model.pose(clock,{attention,collapse,emergence:phase==='dormant'?0:phase==='calm'?.45*smooth(age,0,1.4):phase==='intro'?T.MathUtils.lerp(.45,1,smooth(age,0,2)):1,activeArm:phase==='combat'&&!reloading&&beat!=='recovery'?armIndex:-1,charge:phase==='combat'&&!reloading&&beat!=='recovery'?1-clamp(timer/tellDuration,0,1):0});
  const lift=phase==='intro'?smooth(age,1,6):phase==='combat'||phase==='death'?1:phase==='cleared'?1-smooth(departAge,0,4):0;craft.setHover?.(lift);
  ui.hidden=phase!=='combat'||game.ended;const hp=arms.reduce((n,a)=>n+Math.max(0,a.hp),0);ui.querySelector('.queen-health span').style.width=(100*hp/(8*QUEEN_ARM_HP))+'%';ui.querySelector('.queen-count').textContent=alive().length+' / 8 ARMS';ui.querySelector('.queen-state').textContent=reloading?'RELOADING · '+Math.max(0,timer).toFixed(1)+'s':beat==='recovery'?'QUEEN RECOVERING · KEEP FIRING':beat==='windup'?'ARM '+Math.min(8,armIndex+1)+' · '+['MUD','SPIKE','BOMB'][shotIndex]+' CHARGING · BREAK THE RED TIP':'ARM '+Math.min(8,armIndex+1)+' · '+['MUD','SPIKE','BOMB'][shotIndex];for(const [i,b]of bars.entries()){b.classList.toggle('destroyed',arms[i].dead);b.classList.toggle('firing',!reloading&&beat!=='recovery'&&i===armIndex);b.style.setProperty('--health',clamp(arms[i].hp/QUEEN_ARM_HP,0,1));}
  if(phase!=='intro'&&phase!=='death'){cinema.hidden=true;return false;}cinema.hidden=game.ended;
  cinema.querySelector('span').textContent=phase==='death'?'THE QUEEN FALLS':age<8?'NESTING GROUND':age<12?'SHE HAS SEEN US':'TAKE YOUR STATION';cinema.querySelector('strong').textContent=phase==='death'?'THE EXIT IS YOURS.':age<8?'WEAPONS LOCKED.':age<12?'ROTORS UP. HOVER LOCK.':'TARGET THE RED TENTACLE TIPS.';
  const c=centerAt(QUEEN_POSITION);target.copy(c).setY(phase==='death'?Math.max(10,40-collapse*25):40);// Follow the authored river center behind the aircraft. A fixed Queen-relative
  // offset can put the exterior camera inside the narrow approach bank.
  eye.copy(centerAt(Math.max(.78,flightProgress(rawProgress())-.025)));eye.y=81;eye.x+=14;
  if(!reduced())eye.x+=Math.sin(age*.17)*3;
  look.lookAt(eye,target,V(0,1,0));viewQuat.setFromRotationMatrix(look);const enter=smooth(age,0,1.5);eye.lerp(startEye,1-enter);viewQuat.slerp(startQuat,1-enter);
  const ending=smooth(age,phase==='intro'?12:6.4,phase==='intro'?14:8);if(parent&&ending>0){parent.getWorldPosition(endEye);parent.getWorldQuaternion(endQuat);eye.lerp(endEye,ending);viewQuat.slerp(endQuat,ending);}
  camera.position.copy(eye);camera.quaternion.copy(viewQuat);camera.fov=T.MathUtils.lerp(62,playerFov(),ending);camera.updateProjectionMatrix();camera.updateWorldMatrix(true,false);return true;
 }
 function trace(origin,direction,maxDistance){if(phase!=='combat')return null;const collisionRoot=model.collisionRoot||model.root;collisionRoot.updateMatrixWorld(true);ray.set(origin,direction);ray.far=maxDistance;const candidates=collisionRoot.children.filter(n=>n.isMesh&&!n.isInstancedMesh&&!arms.some(a=>a.mesh===n)&&!n.name.includes('Lava')&&!n.name.includes('lava'));for(const a of arms)if(!a.dead){candidates.push(a.mesh);a.tip.traverse(n=>{if(n.isMesh)candidates.push(n);});}const h=ray.intersectObjects(candidates,false)[0];if(!h)return null;const a=arms.find(a=>a.mesh===h.object||h.object.parent===a.tip);return{kind:a&&a.mesh!==h.object?'queen-arm':'queen-shell',actor:a||model,distance:h.distance,point:h.point.clone(),normal:h.face.normal.clone().transformDirection(h.object.matrixWorld)};}
 function hit(a,point,damage){if(phase!=='combat'||!a||a.dead)return false;a.hp=Math.max(0,a.hp-damage);hitFeedback?.hit(a);audio.creature('queenArm',point,false);audio.confirmHit();game.hitMarker=.16;event('arm-hit',{arm:a.index+1,damage,hp:a.hp});if(a.hp)return false;audio.creature('queenArm',point,true);a.dead=true;a.commitment=false;a.deathAt=clock;a.mesh.visible=a.tip.visible=false;for(const s of a.suckers)s.visible=false;burst(a.muzzle.getWorldPosition(V()),{scale:1.5,source:a.id});if(!a.credited){a.credited=true;award(QUEEN_RULES.armPoints,a.id);}event('arm-destroyed',{arm:a.index+1});if(!alive().length)startMovie('death');return true;}
 function reset(){restoreCamera();attackOrder.reset();phase='dormant';age=clock=cycle=armIndex=orderIndex=shotIndex=timer=departAge=0;reloading=false;beat='windup';tellDuration=QUEEN_RULES.firstTellSeconds;events.length=0;model.reset();model.root.visible=false;ui.hidden=cinema.hidden=true;craft.setHover?.(0);for(const e of eggs){e.laid=false;e.group.scale.setScalar(1);}}
 function canSkipCinematic(){return age>=1&&(phase==='death'||phase==='intro'&&seenIntro);}
 function skipCinematic(){if(game.paused||game.ended||!canSkipCinematic())return false;event('cinematic-skipped');if(phase==='intro')beginCombat();else finish();return true;}
 function cancel(){restoreCamera();ui.hidden=cinema.hidden=true;craft.setHover?.(0);}
 const stats=()=>({attackOrder:attackOrder.stats(),phase,age,clock,cycle,arm:armIndex+1,shot:['mud','spike','bomb'][shotIndex],reloading,beat,timer,tellDuration,canSkipCinematic:canSkipCinematic(),reloadRemaining:reloading?Math.max(0,timer):0,hp:arms.reduce((n,a)=>n+a.hp,0),maxHp:8*QUEEN_ARM_HP,surviving:alive().length,laidEggs:eggs.filter(e=>e.laid).length,locked:phase==='calm'||phase==='intro'||phase==='death',hover:phase==='combat'||phase==='death',cameraDetached:!!parent,events:events.slice(),arms:model.stats().arms});
 reset();return{model,arms,eggs,update,present,trace,hit,reset,cancel,skipCinematic,get canSkipCinematic(){return canSkipCinematic();},flightProgress,speedScale,stats,get quiet(){return phase!=='dormant';},get cinematic(){return phase==='intro'||phase==='death';},get locked(){return phase==='calm'||phase==='intro'||phase==='death';},get cleared(){return phase==='cleared';},get phase(){return phase;}};
}
