import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as THREE from '../game/vendor/three.module.js?v=052';
import {GLTFLoader} from '../game/vendor/GLTFLoader.js?v=052';
import {createBankDemons} from '../game/src/bank-demons.js';
import {createEmberPriestKit,inPlacePriestClip,EMBER_PRIEST_THROW_RELEASE} from '../game/src/ember-priest.js';
import {SKINNED_SOLIDS} from '../game/src/skinned-solids.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),spec=SKINNED_SOLIDS.dancers;
const bytes=readFileSync(new URL('../game/assets/field-notes-v02/ember-priest-v01.glb',import.meta.url));
assert.equal(bytes.length,spec.bytes);
assert.equal(createHash('sha256').update(bytes).digest('hex'),spec.sha256);
assert.equal(bytes.subarray(0,4).toString(),'glTF');

const loader=new GLTFLoader();
loader.register(parser=>{parser.loadTexture=async()=>null;return{name:'EmberPriestTestNoTextures'};});
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const names=gltf.animations.map(clip=>clip.name).sort();
assert.deepEqual(names,['priest_dance','priest_idle','priest_run','priest_throw','priest_walk']);
assert.equal(gltf.scene.getObjectByName('RightHand')?.isBone,true);
assert.ok(gltf.scene.getObjectByName('EmberPriestArmature')&&!gltf.scene.getObjectByName('EmberPriestArmature').isBone);

const rest=gltf.scene.getObjectByName('Hips').position;
for(const name of ['priest_walk','priest_run','priest_dance','priest_throw']){
 const source=gltf.animations.find(clip=>clip.name===name),clip=inPlacePriestClip(source,rest),track=clip.tracks.find(item=>item.name==='Hips.position');
 assert.deepEqual(Array.from(track.values.slice(0,3)),Array.from(track.values.slice(-3)),name+' returns to its game-owned root anchor');
}

const solid={spec,scene:gltf.scene,animations:gltf.animations},kit=createEmberPriestKit(solid),parent=new THREE.Group();
assert.equal(kit.stats.triangles,41344);
const visuals=Array.from({length:8},(_,index)=>kit.attach(parent,index));
const skeletons=[],materials=[];
for(const visual of visuals){
 visual.visual.traverse(node=>{if(node.isSkinnedMesh)skeletons.push(node.skeleton);});
 materials.push(...visual.visual.userData.emberPriestMaterials);
}
assert.equal(new Set(skeletons).size,8,'each priest owns its skeleton');
assert.equal(new Set(materials).size,8,'each priest owns its material state');
assert.deepEqual([...new Set(visuals.map(visual=>visual.phaseFamily))],[0,1,2]);
visuals[0].setWarmth(1);const orange=materials[0].color.clone();
visuals[0].setWarmth(0);const grey=materials[0].color.clone();
assert.ok(orange.r>orange.g*2&&orange.g>orange.b*2,'undisturbed material is orange');
assert.ok(Math.max(grey.r,grey.g,grey.b)-Math.min(grey.r,grey.g,grey.b)<.04,'disturbed material is neutral grey');
visuals[0].syncThrow(EMBER_PRIEST_THROW_RELEASE);parent.updateMatrixWorld(true);
assert.ok(visuals[0].throwingHandWorld(V())?.length()>0,'throw samples the authored RightHand');

const shadows=new THREE.InstancedMesh(new THREE.CircleGeometry(1,8),new THREE.MeshBasicMaterial(),8);
const danceSite={center:V(),ringRadius:15,p:.75,side:1,shadowMesh:shadows,radius:30,top:0,rock:null};
const bank=createBankDemons({scene:new THREE.Scene(),centerAt:()=>V(),widthAt:()=>20,bankMeshes:[],danceSite,priestKit:kit});
let stats=bank.stats();
assert.equal(stats.emberPriests,8);assert.equal(stats.priestAttached,8);assert.equal(stats.orange,8);assert.equal(stats.priestVisible,8);
assert.deepEqual(bank.actors.filter(actor=>actor.isEmber).map(actor=>actor.priestVisual.phaseFamily),[0,1,2,0,1,2,0,1]);
assert.ok(bank.awaken(0,danceSite.center));bank.update(2,danceSite.center);stats=bank.stats();
assert.equal(stats.grey,8);assert.equal(stats.orange,0);
assert.ok(bank.actors.filter(actor=>actor.isEmber).every(actor=>actor.archetype==='ember-priest'));
const priest=bank.actors.find(actor=>actor.isEmber);priest.state='windup';priest.timer=0;bank.pose(priest,2);
const hand=priest.priestVisual.throwingHandWorld(V());assert.ok(hand.distanceTo(priest.throwOrigin)<1e-5,'mud release stays on the animated RightHand');

console.log(JSON.stringify({passed:true,asset:spec.sha256,priests:stats.emberPriests,phaseFamilies:kit.stats.phaseFamilies,grey:stats.grey},null,2));
