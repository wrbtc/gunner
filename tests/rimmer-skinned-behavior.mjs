import assert from 'node:assert/strict';
import * as T from '../game/vendor/three.module.js?v=052';
import {createRimmerSkinnedModel} from '../game/src/rimmer-skinned-model.js';
import {createRimmerModel} from '../game/src/rimmer-model.js?v=052';
const V=a=>new T.Vector3().fromArray(a),close=(a,b,note)=>assert.ok(a.distanceTo(b)<1e-6,note+' '+a.distanceTo(b));
function fixture(){
 const scene=new T.Group(),bones=[],rig={scale:8,floorY:-.62,body:[0,-.12,0],head:[0,-.12,.32],mouth:[0,-.235,.56],legs:[],scythes:[]};
 function bone(name,point,parent,parentPoint){const b=new T.Bone();b.name=name;b.position.copy(V(point).sub(V(parentPoint)));parent.add(b);bones.push(b);return b;}
 const body=bone('rimmer_body',rig.body,scene,[0,0,0]),head=bone('rimmer_head',rig.head,body,rig.body);bone('rimmer_mouth',rig.mouth,head,rig.head);for(const side of [-1,1])bone(side<0?'mandible_L':'mandible_R',[side*.08,-.2,.5],head,rig.head);
 for(const side of [-1,1])for(const i of [0,1]){
  const name=(i?'hind':'front')+(side<0?'_L':'_R'),z=i?-.3:.3;
  const spec={name,side,i,hip:[side*.15,-.12,z],knee:[side*.45,0,z],ankle:[side*.55,-.57,z],toe:[side*.6,-.62,z+.07]};rig.legs.push(spec);
  const upper=bone(name+'_upper',spec.hip,body,rig.body),lower=bone(name+'_lower',spec.knee,upper,spec.hip);bone(name+'_foot',spec.ankle,lower,spec.knee);
 }
 for(const side of [-1,1]){const name='scythe'+(side<0?'_L':'_R');rig.scythes.push({name,side});bone(name+'_upper',[side*.1,.1,0],body,rig.body);}
 const geo=new T.BufferGeometry(),foot=rig.legs[0],footIndex=bones.findIndex(b=>b.name===foot.name+'_foot');
 geo.setAttribute('position',new T.Float32BufferAttribute([...foot.toe,...foot.ankle,...foot.knee],3));geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(Array(3).fill([footIndex,0,0,0]).flat(),4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(Array(3).fill([1,0,0,0]).flat(),4));
 const mesh=new T.SkinnedMesh(geo,new T.MeshStandardMaterial());scene.add(mesh);scene.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));scene.userData.rimmerRig=rig;return {scene,mesh};
}
const solid=fixture(),a=createRimmerSkinnedModel(solid),b=createRimmerSkinnedModel(solid),legacy=createRimmerModel();
assert.ok(a.skin);assert.notEqual(a.legs[0].upperBone,b.legs[0].upperBone);assert.equal(a.mouth.name,'rimmer_mouth');assert.ok(createRimmerSkinnedModel(null).root);
assert.throws(()=>createRimmerSkinnedModel({scene:new T.Group()}),/metadata missing/);
for(const node of ['body','head','abdomen'])close(a[node].position,legacy[node].position,'collision proxy rest '+node);
let skinMesh;a.skin.traverse(n=>{if(n.isSkinnedMesh)skinMesh=n;});const sourceBefore=solid.mesh.skeleton.bones.map(n=>n.quaternion.toArray());
a.root.position.set(12,30,-42);a.root.scale.setScalar(3);a.root.rotation.y=.73;a.body.position.y=5.33;a.body.rotation.z=.02;a.head.rotation.x=.22;a.arms[0].rotation.x=-.16;a.throat.scale.setScalar(.59);a.syncPose();
for(const leg of a.legs){
 const target=leg.restFoot.clone().add(new T.Vector3(0,.12/3,.2));a.poseLeg(leg,null,null,target);
 assert.ok(leg.reachError<1e-6,'reachable target must not clamp');assert.ok(leg.contactError<1e-6,'skinned toe reaches requested target');
 const actual=leg.footBone.localToWorld(leg.restToe.clone().sub(leg.restAnkle));close(actual,a.root.localToWorld(target.clone()),'real toe contact');
}
skinMesh.skeleton.update();const deformed=skinMesh.getVertexPosition(0,new T.Vector3()).applyMatrix4(skinMesh.matrixWorld),target=a.root.localToWorld(a.legs[0].foot.clone());close(deformed,target,'weighted vertex reaches contact, not only helper');
assert.deepEqual(solid.mesh.skeleton.bones.map(n=>n.quaternion.toArray()),sourceBefore,'template skeleton not mutated');
assert.ok(b.legs[0].upperBone.quaternion.equals(new T.Quaternion()),'other actor remains untouched');
for(const key of ['body','head','abdomen']){legacy[key].position.copy(a[key].position);legacy[key].quaternion.copy(a[key].quaternion);}
legacy.root.position.copy(a.root.position);legacy.root.quaternion.copy(a.root.quaternion);legacy.root.scale.copy(a.root.scale);legacy.root.updateMatrixWorld(true);
for(const key of ['body','head','abdomen'])close(a[key].getWorldPosition(new T.Vector3()),legacy[key].getWorldPosition(new T.Vector3()),'collision proxy unchanged '+key);
const mouthBefore=a.mouth.getWorldPosition(new T.Vector3());a.jaws[0].rotation.y+=.11;a.syncPose();assert.ok(Math.abs(a.skin.getObjectByName('mandible_L').rotation.y+.11)<1e-8,'warning opens the actual mandible');close(a.mouth.getWorldPosition(new T.Vector3()),mouthBefore,'mandible opening leaves mouth emitter on head');
const firstPose=a.legs.map(l=>l.upperBone.quaternion.toArray());for(const leg of a.legs)a.poseLeg(leg,null,null,leg.foot);assert.deepEqual(a.legs.map(l=>l.upperBone.quaternion.toArray()),firstPose,'pose is deterministic');
a.poseLeg(a.legs[0],null,null,new T.Vector3(1000,1000,1000));assert.ok(a.legs[0].reachError>0);assert.ok(Number.isFinite(a.legs[0].contactError));
a.resetPose();for(const leg of a.legs){assert.ok(leg.upperBone.quaternion.equals(new T.Quaternion()));assert.equal(leg.contactError,0);}
assert.equal(a.mouth,a.skin.getObjectByName('rimmer_mouth'));assert.equal(a.stats().legs,4);
console.log('PASS: independently skinned Rimmer clones, unchanged collision proxies, rigid-segment IK with actual weighted toe contact under scaled/rotated actor and body pose, finite unreachable-target diagnostics, and deterministic reset');

// Actual packaged-export validation (an optional path selects another candidate): texture decode is covered by browser tests;
// this CPU pass deliberately isolates terrain contact and real skin deformation.
{
 const actualAsset=process.argv[2]||new URL('../game/assets/rimmer-meshy-v2-rigged.glb',import.meta.url);

 const {readFileSync}=await import('node:fs'),{GLTFLoader}=await import('../game/vendor/GLTFLoader.js?v=052'),{createRimmers}=await import('../game/src/rimmers.js');
 const loader=new GLTFLoader();loader.register(parser=>{parser.loadTexture=async()=>null;return {name:'GeometryInspectionOnly'};});
 const bytes=readFileSync(actualAsset),actual=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 globalThis.document={createElement:()=>({style:{},getContext:()=>({clearRect(){}})}),body:{appendChild(){}}};
 // A tall discontinuity beside the body reproduces the actual canyon-lip bug.
 // The whole rigid foot must choose the upper terrace; its unsupported toe may
 // not be stretched down to the adjacent forty-unit-lower triangle.
 const cliffModel=createRimmerSkinnedModel(actual),cliff={at:x=>x>9?-40:0};cliffModel.root.scale.setScalar(3);
 // Visible upper-shell vertices from the founder-reported stiff-leg regression.
 // Source positions prevent a different part from silently replacing the cap.
 const capCases=[
  {index:31097,leg:'front_L',position:[-.380641,-.099765,.224214]},
  {index:15467,leg:'front_R',position:[.361673,-.080055,.215789]},
  {index:10808,leg:'front_R',position:[.369391,-.056120,.146623]},
  {index:37811,leg:'hind_R',position:[.370442,-.086852,-.515661]},
  {index:42519,leg:'hind_L',position:[-.348214,-.118470,-.460468]}
 ];
 let capMesh;cliffModel.skin.traverse(n=>{if(n.isSkinnedMesh)capMesh=n;});
 const capBody=cliffModel.skin.getObjectByName('rimmer_body'),capPosition=new T.Vector3();
 for(const c of capCases){
  const attributes=capMesh.geometry.attributes;capPosition.fromBufferAttribute(attributes.position,c.index);
  close(capPosition,V(c.position),'known upper-shell surface identity '+c.index);
  let ownWeight=0,upperWeight=0;
  for(let slot=0;slot<4;slot++){
   const weight=attributes.skinWeight.array[c.index*4+slot],bone=capMesh.skeleton.bones[attributes.skinIndex.array[c.index*4+slot]];
   if(bone.name===c.leg+'_upper'||bone.name===c.leg+'_lower')ownWeight+=weight;
   if(bone.name===c.leg+'_upper')upperWeight+=weight;
  }
  assert.ok(ownWeight>1-1e-6,'upper shell must follow its own walking leg, never torso/scythe: '+c.index);
  assert.ok(upperWeight>.55,'upper shell must retain upper-segment ownership: '+c.index);
  c.bone=cliffModel.skin.getObjectByName(c.leg+'_upper');c.maxBodyRelativeTravel=0;c.maxUpperJointAngle=0;
 }
 // Raised scythes must not drag walking caps, even where silhouettes overlap.
 cliffModel.root.updateMatrixWorld(true);capMesh.skeleton.update();
 const capBeforeScythes=capCases.map(c=>capMesh.getVertexPosition(c.index,new T.Vector3()).applyMatrix4(capMesh.matrixWorld));
 const movedScythes=[];cliffModel.skin.traverse(n=>{if(n.isBone&&n.name.startsWith('scythe_')){movedScythes.push([n,n.quaternion.clone()]);n.rotateX(.35);}});
 cliffModel.root.updateMatrixWorld(true);capMesh.skeleton.update();
 for(const [i,c]of capCases.entries())close(capMesh.getVertexPosition(c.index,new T.Vector3()).applyMatrix4(capMesh.matrixWorld),capBeforeScythes[i],'walking cap isolated from raised scythes '+c.index);
 for(const [bone,quaternion]of movedScythes)bone.quaternion.copy(quaternion);
 let previousFeet=null,maxCliffDrift=0;
 for(let frame=0;frame<240;frame++){
  const t=frame/60;cliffModel.root.position.set(0,0,-t*12.6);cliffModel.root.rotation.y=.2*Math.sin(t);cliffModel.body.position.y=5.2+Math.sin(t)*.13;cliffModel.syncPose();cliffModel.stepFeet({gait:t*12.6/8.7,ground:cliff,dt:1/60});
  assert.ok(cliffModel.stats().maxContactError<1e-4,'cliff targets must be reachable without stretching');
  // Body-relative skin positions exclude root travel and thorax bob. These
  // upper-joint poses come from the actual terrain solver above.
  capMesh.skeleton.update();
  for(const c of capCases){
   const point=capBody.worldToLocal(capMesh.getVertexPosition(c.index,new T.Vector3()).applyMatrix4(capMesh.matrixWorld));
   if(!c.firstPoint){c.firstPoint=point.clone();c.firstUpperQuaternion=c.bone.quaternion.clone();}
   c.maxBodyRelativeTravel=Math.max(c.maxBodyRelativeTravel,point.distanceTo(c.firstPoint));
   c.maxUpperJointAngle=Math.max(c.maxUpperJointAngle,c.bone.quaternion.angleTo(c.firstUpperQuaternion));
  }
  const feet=cliffModel.supportStats(cliff);for(const [i,foot]of feet.entries()){assert.ok(foot.minClearance>-.02,'all rigid claw vertices clear the cliff');if(foot.planted&&previousFeet?.[i].planted)maxCliffDrift=Math.max(maxCliffDrift,...foot.footMatrix.map((n,j)=>Math.abs(n-previousFeet[i].footMatrix[j])));}previousFeet=feet;
 }
 assert.ok(maxCliffDrift<1e-4,'whole planted rigid foot transform is fixed in world space');
 for(const c of capCases){
  assert.ok(c.maxUpperJointAngle>.08,'terrain solver must articulate the upper leg '+c.leg);
  assert.ok(c.maxBodyRelativeTravel>.025,'visible upper shell must move with the articulated leg '+c.index);
 }
 console.log('PASS actual upper-shell ownership, scythe isolation and terrain-driven surface motion:',JSON.stringify(capCases.map(({index,leg,maxBodyRelativeTravel,maxUpperJointAngle})=>({index,leg,maxBodyRelativeTravel,maxUpperJointAngle}))));
 const summaries=[];
 for(const slope of [[0,0],[.15,.08],[-.15,-.08]]){
  const geometry=new T.PlaneGeometry(1000,5000).rotateX(-Math.PI/2).translate(0,0,-1500),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++)positions.setY(i,positions.getX(i)*slope[0]+positions.getZ(i)*slope[1]);
  const terrain=new T.Mesh(geometry);terrain.userData.authoredContinuousCliff=true;
  let time=0;const aimTarget=()=>new T.Vector3(0,30,-305-32*time),game={time:0};
  const controller=createRimmers({solid:actual,scene:new T.Scene(),camera:new T.PerspectiveCamera(),game,centerAt:p=>new T.Vector3(0,0,-3050*p),widthAt:()=>80,bankMeshes:[terrain],audio:{},aimTarget,progress:()=>.1+time*.01,launch:()=>false,logEvent(){},canAttack:()=>false,activeCommitments:()=>0,traceTerrain:()=>false,postMaterial:{uniforms:{},fragmentShader:'gl_FragColor=vec4(c,1.);'},captureFrame(){},reduced:()=>true});
  // Match the exact weighted lowest-toe vertices before changing the rest pose.
  for(const actor of controller.actors){actor.root.updateMatrixWorld(true);for(const l of actor.legs){
   const toe=actor.visual.localToWorld(l.restToe.clone());let best={distance:Infinity};
   actor.skin.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld),distance=p.distanceTo(toe);if(distance<best.distance)best={mesh,index:i,distance};}});
   assert.ok(best.distance<1e-5,'toe metadata must identify an actual skin vertex');l.testVertex=best;
  }}
  controller.update(0,0);
  for(const actor of controller.actors){const d=aimTarget().sub(actor.root.position);actor.root.rotation.y=Math.atan2(-d.x,-d.z);actor.spawnAt=0;actor.state='cooldown';actor.timer=100;}
  let worst={error:0},maxPlantedSlide=0;
  for(let n=0;n<480;n++){
   time=n/60;game.time=time;controller.update(time,1/60);
   for(const actor of controller.actors)for(const l of actor.legs){
    const {mesh,index}=l.testVertex;mesh.skeleton.update();const point=mesh.getVertexPosition(index,new T.Vector3()).applyMatrix4(mesh.matrixWorld),target=actor.root.localToWorld(l.foot.clone()),error=point.distanceTo(target);
    if(l.planted&&l.testWasPlanted&&l.testPrevious)maxPlantedSlide=Math.max(maxPlantedSlide,point.distanceTo(l.testPrevious));l.testPrevious=point;l.testWasPlanted=l.planted;
    if(error>worst.error)worst={error,markerError:l.contactError,reach:l.reachError,actor:actor.id,leg:l.rig.name,time,travel:actor.travel,gait:actor.moveDistance/actor.gaitDistance,heading:actor.root.rotation.y,planted:l.planted};
   }
  }
  summaries.push({slope,worst,maxPlantedSlide});
  assert.ok(worst.error<1e-4,'actual weighted toe contact '+JSON.stringify(worst));
  assert.ok(maxPlantedSlide<1e-4,'actual weighted stance vertices remain world-fixed');
  controller.reset();for(const actor of controller.actors){assert.equal(actor.travel,0);assert.equal(actor.moveDistance,0);for(const l of actor.legs)assert.equal(l.anchor,null);}
 }
 console.log('PASS actual-export weighted toe contact, anchored stance and reset on five actors over flat/sloped ground:',JSON.stringify(summaries));
}
