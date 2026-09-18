import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../game/vendor/three.module.js?v=052';
import {GLTFLoader} from '../game/vendor/GLTFLoader.js?v=052';
import {createBankDemons} from '../game/src/bank-demons.js';
import {inPlaceCreeperClimb,loadCreeperLoco,creeperLocoVisualBounds} from '../game/src/creeper-loco.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const near=(actual,expected,message,tolerance=1e-5)=>assert.ok(actual.distanceTo(expected)<tolerance,message);
const fixture=new THREE.AnimationClip('climb',2,[
  new THREE.VectorKeyframeTrack('Hips.position',[0,.5,1,2],[2,10,-1,4,15,0,7,23,-3,4,30,3]),
  new THREE.QuaternionKeyframeTrack('Hips.quaternion',[0,2],[0,0,0,1,0,.1,0,Math.sqrt(.99)]),
  new THREE.VectorKeyframeTrack('LeftHand.position',[0,2],[0,1,0,0,2,0]),
]);
const original=JSON.stringify(fixture.toJSON()),anchor=V(0,11,-2);
const converted=inPlaceCreeperClimb(fixture,anchor),rootTrack=converted.tracks[0];
near(V().fromArray(rootTrack.values,0),anchor,'ascent starts at the rest anchor');
near(V().fromArray(rootTrack.values,9),anchor,'net travel is removed at the loop endpoint');
near(V().fromArray(rootTrack.values,6),V(4,14,-6),'nonlinear body bob and sway survive');
assert.equal(JSON.stringify(fixture.toJSON()),original,'the source clip is immutable');
assert.deepEqual(converted.tracks.slice(1).map(t=>t.values),fixture.tracks.slice(1).map(t=>t.values),'limb and rotation tracks stay unchanged');
assert.equal(rootTrack.getInterpolation(),fixture.tracks[0].getInterpolation());

// Exercise the bank route and launch-time pose refresh without a renderer.
const stubKit={attach(parent){
  const root=new THREE.Group();parent.add(root);let kind=null;
  return {root,play(next){kind=next;root.userData.kind=next;root.visible=true;},stop(){kind=null;root.visible=false;},
    throwingHandWorld(target){return kind==='throw'&&root.visible?target.copy(V(0,5,-1).applyMatrix4(parent.matrixWorld)):null;}};
}};
const bank=createBankDemons({scene:new THREE.Scene(),centerAt:p=>V(0,0,p*1000),widthAt:()=>20,bankMeshes:[],locoKit:stubKit});
const climber=bank.actors[0];
climber.wallRoute={min:14,max:34,z:climber.z};
climber.wallSurface={sample(y,z){return {point:V(-18,y,z),normal:V(1,0,0),bank:true};}};
climber.gripCache=new Map();climber.gripGeometry=Array.from({length:4},()=>[V()]);
let previousY=null,ascending=0,descending=0;
for(let step=1;step<=420;step++){
  bank.update(step/60,climber.stand);
  const delta=previousY===null?0:climber.root.position.y-previousY;
  if(delta>.00001){assert.equal(climber.locoVisual.root.userData.kind,'climb');ascending++;}
  if(delta<-.00001){assert.equal(climber.locoVisual.root.userData.kind,'climbDown');descending++;}
  previousY=climber.root.position.y;
}
assert.ok(ascending>30&&descending>30,'route exercises both travel directions');
climber.state='windup';climber.timer=2.9;
bank.update(7+1/60,climber.stand);
assert.equal(climber.climbDirection,-1,'stationary bracing retains the previous direction');
bank.reset();assert.equal(climber.climbDirection,1,'restart clears the previous descent');

const ground=bank.actors.find(a=>!a.climb&&a.temperament==='hunter');
ground.state='windup';ground.timer=0;
bank.update(2.9,ground.stand);
const expectedHand=V(0,5,-1).applyMatrix4(ground.root.matrixWorld);
bank.pose(ground,2.9); // launchHostile refreshes this immediately before copying throwOrigin.
near(ground.throwOrigin,expectedHand,'launch-time pose preserves the animated hand');
ground.locoVisual.root.visible=false;bank.pose(ground,2.9);
assert.ok(ground.throwOrigin.distanceTo(expectedHand)>.1,'hidden visuals retain the procedural fallback');

// When LFS assets are present, run the same checks against the shipped skeletons
// and clips. Only image decoding is skipped; Three's actual GLB loader/mixers run.
const assets=['walk','extra','throw','run'];
const assetBytes=assets.map(name=>readFileSync(new URL(`../game/assets/creeper-meshy-${name}.glb`,import.meta.url)));
const realAssets=assetBytes.every(bytes=>bytes.subarray(0,4).toString()==='glTF');
const measurements=[];
if(realAssets){
  const loaded=new Map(),snapshots=new Map(),loadAsync=GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync=async function(url){
    this.register(parser=>{parser.loadTexture=async()=>null;return {name:'CombatTestNoTextures'};});
    const bytes=readFileSync(new URL(url));
    const gltf=await this.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const name=new URL(url).pathname.split('/').at(-1);
    loaded.set(name,gltf);snapshots.set(name,JSON.stringify(gltf.animations.map(clip=>clip.toJSON())));
    return gltf;
  };
  let kit;
  try{kit=await loadCreeperLoco();}finally{GLTFLoader.prototype.loadAsync=loadAsync;}
  const visual=kit.attach(new THREE.Group());
  function sample(kind,time){
    visual.stop();visual.play(kind,time,1);
    const scene=visual.root.children.find(child=>child.visible);
    const box=creeperLocoVisualBounds(scene).box;
    return {hips:scene.getObjectByName('Hips').getWorldPosition(V()),box,scene};
  }
  for(const kind of ['climb','climbDown']){
    const first=sample(kind,.00001),before=sample(kind,1.99999),after=sample(kind,2.00001),later=sample(kind,6.00001);
    near(before.hips,after.hips,`${kind}: no root teleport at the real GLB loop seam`,.001);
    near(first.hips,later.hips,`${kind}: repeated loops do not accumulate displacement`,.001);
    assert.ok(Math.abs(before.box.min.y-after.box.min.y)<.5,`${kind}: visible feet do not jump five metres`);
    assert.ok(sample(kind,.5).hips.distanceTo(first.hips)>.3,`${kind}: body movement remains animated`);
    measurements.push({kind,rootSeamMetres:before.hips.distanceTo(after.hips),feetSeamMetres:Math.abs(before.box.min.y-after.box.min.y)});
  }
  near(sample('climb',.00001).hips,sample('climbDown',.00001).hips,'both directions share the same root anchor',.001);

  // Unaffected actions must still produce the authored local bone transforms.
  for(const [kind,sceneAsset,clipAsset,time] of [['walk','walk','walk',.4],['run','walk','run',.4],['throw','throw','throw',2.9]]){
    const baseline=loaded.get(`creeper-meshy-${sceneAsset}.glb`).scene.clone(true);
    const clip=loaded.get(`creeper-meshy-${clipAsset}.glb`).animations.reduce((best,c)=>!best||c.duration>best.duration?c:best,null);
    const mixer=new THREE.AnimationMixer(baseline);mixer.clipAction(clip).play();mixer.update(time);
    const actual=sample(kind,time).scene;
    baseline.traverse(node=>{
      if(!node.isBone)return;
      const bone=actual.getObjectByName(node.name);
      near(bone.position,node.position,`${kind}: ${node.name} position unchanged`);
      near(bone.scale,node.scale,`${kind}: ${node.name} scale unchanged`);
      assert.ok(1-Math.abs(bone.quaternion.dot(node.quaternion))<1e-5,`${kind}: ${node.name} rotation unchanged`);
    });
  }
  for(const [name,gltf] of loaded)assert.equal(JSON.stringify(gltf.animations.map(clip=>clip.toJSON())),snapshots.get(name),`${name}: original clips untouched`);
  visual.stop();visual.play('climb',.7,1);visual.play('climbDown',1/60,1);
  const climbingScene=visual.root.children.find(child=>child.visible);
  visual.play('throw',2.9,1);
  assert.equal(climbingScene.visible,false,'a separate throw rig does not share the climb blend');
  assert.equal(visual.root.children.filter(child=>child.visible).length,1,'only one rig is rendered');
  const switchedHand=visual.throwingHandWorld(V());
  const standaloneThrow=sample('throw',2.9).scene.getObjectByName('RightHand').getWorldPosition(V());
  near(switchedHand,standaloneThrow,'interrupting a climb blend does not affect the throw pose');

  // A continuous wall route must reverse without resetting the limbs several
  // metres in one frame. Include the full blend window and both directions.
  climber.locoVisual.root.removeFromParent();climber.locoVisual=kit.attach(climber.root);
  bank.reset();climber.state='idle';ground.state='idle';
  const landmarks=['Hips','LeftHand','RightHand','LeftFoot','RightFoot'];
  const reversals=[];let lastPose=null,lastDirection=1,settled=0;
  for(let step=1;step<=540;step++){
    bank.update(step/60,climber.stand);
    const active=climber.locoVisual.root.children.find(child=>child.visible);
    active.updateMatrixWorld(true);
    const pose=landmarks.map(name=>active.getObjectByName(name).getWorldPosition(V()));
    if(climber.climbDirection!==lastDirection){
      reversals.push({step,time:step/60,direction:climber.climbDirection,firstStepMetres:null,maxStepMetres:0});
      lastDirection=climber.climbDirection;
    }
    const reversal=reversals.at(-1);
    if(lastPose&&reversal&&step-reversal.step<=21){
      const jump=Math.max(...pose.map((point,i)=>point.distanceTo(lastPose[i])));
      if(step===reversal.step)reversal.firstStepMetres=jump;
      reversal.maxStepMetres=Math.max(reversal.maxStepMetres,jump);
      assert.ok(jump<.5,`wall reversal at ${reversal.time}s jumps ${jump}m in one frame`);
      if(step-reversal.step===21){
        const kind=reversal.direction<0?'climbDown':'climb';
        const rate=Math.min(1.35,.55+climber.moveRate*.22);
        const expected=sample(kind,(step-reversal.step+1)/60*rate).scene;
        for(const name of landmarks){
          const actualBone=active.getObjectByName(name),expectedBone=expected.getObjectByName(name);
          near(actualBone.position,expectedBone.position,'bounded blend settles to the new clip');
          assert.ok(1-Math.abs(actualBone.quaternion.dot(expectedBone.quaternion))<1e-5,'outgoing pose has no influence after the blend');
        }
        settled++;
      }
    }
    lastPose=pose;
  }
  assert.equal(reversals.length,2);assert.equal(settled,2);
  measurements.push({reversals});

  ground.locoVisual.root.removeFromParent();ground.locoVisual=kit.attach(ground.root);
  bank.reset();ground.state='windup';ground.timer=0;
  bank.update(2.9,ground.stand);
  const throwScene=ground.locoVisual.root.children.find(child=>child.visible);
  const hand=throwScene.getObjectByName('RightHand').getWorldPosition(V());
  bank.pose(ground,2.9);
  near(ground.throwOrigin,hand,'real 2.90s RightHand survives launch-time pose refresh');
  ground.locoVisual.stop();
  assert.equal(ground.locoVisual.throwingHandWorld(V()),null,'stopped visuals cannot supply a stale hand');
}else{
  console.log('SKIP real Meshy animation checks: hydrate Git LFS assets to exercise shipped GLBs');
}
console.log(JSON.stringify({passed:true,ascending,descending,realAssets,measurements}));
