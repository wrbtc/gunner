import assert from 'node:assert/strict';
import * as THREE from '../game/vendor/three.module.js?v=052';
import {cloneSkinnedGuide} from '../game/src/skinned-solids.js?v=054-69';
import {buildGuideModel,cloneGuideTree,cloneGuideMaterial,guideClipLabel} from '../game/src/guide-models.js';
import {clampGuidePan,clampGuideZoom} from '../game/src/field-guide-viewer.js';
assert.equal(clampGuideZoom(0),.6);assert.equal(clampGuideZoom(1),1);assert.equal(clampGuideZoom(4),3);
assert.equal(clampGuidePan(-1),-.65);assert.equal(clampGuidePan(.2),.2);assert.equal(clampGuidePan(1),.65);
const source=new THREE.Group(),bone=new THREE.Bone();bone.name='jaw';source.add(bone);
const geometry=new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0],4));
geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
const texture=new THREE.Texture(),material=new THREE.MeshStandardMaterial({flatShading:true,map:texture});
material.onBeforeCompile=()=>{};
const mesh=new THREE.SkinnedMesh(geometry,material);source.add(mesh);source.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton([bone]));
const clone=cloneSkinnedGuide(source),copy=clone.children.find(n=>n.isSkinnedMesh);
assert.notEqual(copy.skeleton,mesh.skeleton);assert.notEqual(copy.skeleton.bones[0],bone);
assert.equal(copy.skeleton.bones[0].parent,clone);assert.deepEqual(copy.bindMatrix,mesh.bindMatrix);
assert.deepEqual(copy.skeleton.boneInverses[0],mesh.skeleton.boneInverses[0]);
assert.notEqual(copy.skeleton.boneInverses[0],mesh.skeleton.boneInverses[0]);
const materialCopy=cloneGuideMaterial(material);assert.equal(materialCopy.flatShading,true);assert.equal(materialCopy.map,texture);assert.equal(materialCopy.onBeforeCompile,material.onBeforeCompile);
const tree=cloneGuideTree(source),treeMesh=tree.children.find(n=>n.isSkinnedMesh);assert.notEqual(treeMesh.geometry,geometry);assert.notEqual(treeMesh.material,material);assert.notEqual(treeMesh.skeleton.bones[0],bone);
const outside=new THREE.Group();outside.add(mesh.clone());assert.throws(()=>cloneSkinnedGuide(outside),/escapes cloned root/);
let sourceDisposals=0,ownedDisposals=0;for(const r of [geometry,material,texture,mesh.skeleton])r.addEventListener?.('dispose',()=>sourceDisposals++);
const clip=new THREE.AnimationClip('cinder_idle',1,[new THREE.NumberKeyframeTrack('jaw.position[x]',[0,.5,1],[0,.2,0])]);
const solid={museumRoot(){const root=cloneSkinnedGuide(source),mixer=new THREE.AnimationMixer(root);mixer.clipAction(clip).play();root.userData.guideMixer=mixer;root.userData.guideClips=[clip];return root;}};
const model=await buildGuideModel('tanks',{skinnedSolids:{tanks:solid}});let animated;model.root.traverse(n=>{if(n.isSkinnedMesh)animated=n;});
assert.notEqual(animated.geometry,geometry);assert.notEqual(animated.material,material);
for(const r of [animated.geometry,animated.material])r.addEventListener('dispose',()=>ownedDisposals++);
model.tick(.25);assert.ok(animated.skeleton.bones[0].position.x>0);assert.equal(bone.position.x,0);
model.dispose();model.dispose();assert.equal(ownedDisposals,2);assert.equal(sourceDisposals,0);
const stopped=animated.skeleton.bones[0].position.x;model.tick(.25);model.playClip('cinder_idle');assert.equal(animated.skeleton.bones[0].position.x,stopped);

const {assembleIntactEgg}=await import('../game/src/field-guide-egg-parts.js');
const {adaptEggShellMaterial}=await import('../game/src/egg-solids.js?v=054-67');
const shellGeo=new THREE.SphereGeometry(.4,8,6),maggotGeo=new THREE.BoxGeometry(1.9,.35,.7);
const shellMat=new THREE.MeshStandardMaterial({color:0xffffff,transparent:false,opacity:1,roughness:.2});
const maggotMat=new THREE.MeshStandardMaterial({color:0x553322});
const wriggle=new THREE.AnimationClip('maggot_wriggle',1,[new THREE.NumberKeyframeTrack('jaw.position[x]',[0,.5,1],[0,.2,0])]);
const shellSolid={museumRoot(){const root=new THREE.Group();root.name='Museum egg-shell';root.add(new THREE.Mesh(shellGeo,shellMat));return root;}};
const maggotSolid={spec:{clips:{idle:'maggot_wriggle'}},museumRoot(){const root=new THREE.Group();root.name='Museum egg-maggot';root.add(new THREE.Mesh(maggotGeo,maggotMat));const mixer=new THREE.AnimationMixer(root);mixer.clipAction(wriggle).play();root.userData.guideMixer=mixer;root.userData.guideClips=[wriggle];return root;}};
const assembled=assembleIntactEgg(shellSolid,maggotSolid);
assert.equal(assembled.name,'Museum eggs');
assert.equal(assembled.children.length,2);
let leather=0,inner=0;assembled.traverse(n=>{if(!n.isMesh)return;if(n.parent?.name==='Museum egg-shell'){leather++;assert.equal(n.material.transparent,true);assert.ok(n.material.opacity<.88);assert.equal(n.material.depthWrite,false);assert.equal(n.renderOrder,2);}if(n.parent?.name==='Museum egg-maggot')inner++;});
assert.equal(leather,1);assert.equal(inner,1);
const shellBox=new THREE.Box3().setFromObject(assembled.children[0]),maggotBox=new THREE.Box3().setFromObject(assembled.children[1]);
assert.ok(shellBox.containsBox(maggotBox),'maggot must sit inside the shell');
assert.equal(assembled.userData.guideClips[0].name,'maggot_wriggle');
const intact=await buildGuideModel('eggs',{skinnedSolids:{eggs:{museumRoot:()=>assembleIntactEgg(shellSolid,maggotSolid)}}});
assert.equal(intact.root.name,'Guide eggs');
assert.ok(intact.clips.some(c=>c.name==='maggot_wriggle'));
assert.equal(intact.activeClip,'maggot_wriggle');
let called=false;const intactGuide={guideModel(){called=true;return new THREE.Group();}};
await buildGuideModel('eggs',{eggNests:intactGuide,skinnedSolids:{eggs:{museumRoot:()=>assembleIntactEgg(shellSolid,maggotSolid)}}});
assert.equal(called,false);
const expectedLeather=adaptEggShellMaterial(shellMat);
assert.equal(expectedLeather.opacity,.46);
intact.dispose();

assert.equal(guideClipLabel('ritual_idle'),'Idle');
assert.equal(guideClipLabel('ritual_walk'),'Walk');
assert.equal(guideClipLabel('ember_run'),'Run');
assert.equal(guideClipLabel('CL_cliff_climb'),'Climb');
assert.equal(guideClipLabel('Angry Ground Stomp'),'Egg-anger');
assert.equal(guideClipLabel('AN_angry_ground_stomp'),'Egg-anger');
assert.equal(guideClipLabel('HW_Ground_Stomp'),'Egg-anger');
assert.equal(guideClipLabel('Wave_One_Hand'),'Egg-anger');
assert.equal(guideClipLabel('AN_wave_one_hand'),'Egg-anger');
assert.equal(guideClipLabel('Over_Shoulder_Throw'),'Throw');
assert.equal(guideClipLabel('ritual_throw'),'Throw');
assert.equal(guideClipLabel('AN_jewel_turn'),'Jewel Turn');
assert.doesNotMatch(guideClipLabel('Wave_One_Hand'),/wave/i);
assert.doesNotMatch(guideClipLabel('Angry Ground Stomp'),/wave/i);

const idle=new THREE.AnimationClip('ritual_idle',1,[new THREE.NumberKeyframeTrack('jaw.position[x]',[0,.5,1],[0,.1,0])]);
const walk=new THREE.AnimationClip('ritual_walk',1,[new THREE.NumberKeyframeTrack('jaw.position[x]',[0,.5,1],[0,.3,0])]);
const run=new THREE.AnimationClip('ritual_run',1,[new THREE.NumberKeyframeTrack('jaw.position[x]',[0,.5,1],[0,.4,0])]);
const climb=new THREE.AnimationClip('CL_cliff_climb',1,[new THREE.NumberKeyframeTrack('jaw.position[x]',[0,.5,1],[0,.15,0])]);
const stomp=new THREE.AnimationClip('Angry Ground Stomp',1,[new THREE.NumberKeyframeTrack('jaw.position[x]',[0,.5,1],[0,.5,0])]);
const toss=new THREE.AnimationClip('Over_Shoulder_Throw',1,[new THREE.NumberKeyframeTrack('jaw.position[x]',[0,.5,1],[0,.6,0])]);
const extra=new THREE.AnimationClip('AN_jewel_turn',1,[new THREE.NumberKeyframeTrack('jaw.position[x]',[0,.5,1],[0,.05,0])]);
const dancerSolid={museumRoot(){const root=cloneSkinnedGuide(source),mixer=new THREE.AnimationMixer(root);mixer.clipAction(idle).play();root.userData.guideMixer=mixer;root.userData.guideClips=[idle,walk,run,climb,stomp,toss,extra];return root;}};
const dancers=await buildGuideModel('dancers',{skinnedSolids:{dancers:dancerSolid}});
assert.deepEqual(dancers.clips.map(c=>[c.name,c.label]),[
 ['ritual_idle','Idle'],
 ['ritual_walk','Walk'],
 ['ritual_run','Run'],
 ['CL_cliff_climb','Climb'],
 ['Angry Ground Stomp','Egg-anger'],
 ['Over_Shoulder_Throw','Throw'],
 ['AN_jewel_turn','Jewel Turn']
]);
assert.equal(dancers.activeClip,'ritual_idle');
assert.ok(!dancers.clips.some(c=>/wave/i.test(c.label)),'Egg-anger must not display as Wave');
assert.ok(!dancers.clips.some(c=>c.name==='ritual_jump'),'missing clips must not become dead MOTION rows');
dancers.playClip('ritual_walk');
assert.equal(dancers.activeClip,'ritual_walk');
let dancerBone;dancers.root.traverse(n=>{if(n.isSkinnedMesh)dancerBone=n.skeleton.bones[0];});
dancers.tick(.25);
assert.ok(dancerBone.position.x>0);
dancers.playClip('Angry Ground Stomp');
assert.equal(dancers.activeClip,'Angry Ground Stomp');
dancers.dispose();

const liveIdle=new THREE.AnimationClip('ritual_idle',1,[new THREE.NumberKeyframeTrack('jaw.position[x]',[0,1],[0,0])]);
const liveWalk=new THREE.AnimationClip('ritual_walk',1,[new THREE.NumberKeyframeTrack('jaw.position[x]',[0,1],[0,.2])]);
const liveOnly={museumRoot(){const root=cloneSkinnedGuide(source),mixer=new THREE.AnimationMixer(root);mixer.clipAction(liveIdle).play();root.userData.guideMixer=mixer;root.userData.guideClips=[liveIdle,liveWalk];return root;}};
const liveDancers=await buildGuideModel('dancers',{skinnedSolids:{dancers:liveOnly}});
assert.deepEqual(liveDancers.clips.map(c=>c.label),['Idle','Walk']);
assert.equal(liveDancers.activeClip,'ritual_idle');
liveDancers.dispose();

console.log('PASS: independent skeletons/bind matrices, flat shading, independent animation and idempotent owned-resource disposal; Intact egg assembles leather shell + nested maggot without cloning live nests; dancers MOTION lists every supplied clip');
