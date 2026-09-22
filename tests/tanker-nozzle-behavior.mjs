import assert from 'node:assert/strict';
import * as THREE from '../game/vendor/three.module.js?v=052';
import {createTankerSpray} from '../game/src/tanker-spray.js?v=054-87a';

function sprayAlong(localForward){
  const events=[];
  const scene=new THREE.Scene();
  const root=new THREE.Group();
  // Heading 0 plus the Cinder heading offset faces authored +Z along world -Z.
  root.rotation.y=Math.PI;
  const mouth=new THREE.Bone();
  root.add(mouth);
  scene.add(root);
  root.updateMatrixWorld(true);
  const actor={
    id:'tank-0',dead:false,state:'idle',windupSeconds:2.2,root,mouthAnchor:mouth,
    poseTanker(){},
    ...(localForward?{cinderRig:{forwardLocal:localForward.clone()}}:{}),
  };
  const spray=createTankerSpray({
    scene,actors:[actor],traceTerrain:()=>null,hitHull:()=>null,damageHull(){},
    planePos:new THREE.Vector3(),planeVel:new THREE.Vector3(),
    audio:{tanker(){},tankerState(){}},
    logEvent:(name,detail)=>events.push({name,detail}),
  });
  assert.equal(spray.start(actor,0),true);
  spray.update(0,0);
  const shot=events.find(event=>event.name==='tanker-fireball');
  assert.ok(shot,'a posed nozzle must release a fireball');
  return new THREE.Vector3().fromArray(shot.detail.velocity).normalize();
}

const travel=new THREE.Vector3(0,0,-1);
const cinder=sprayAlong(new THREE.Vector3(0,0,1));
assert.ok(cinder.dot(travel)>0.99,`Cinder Maw fire must leave along the furnace, got ${cinder.toArray()}`);
const legacy=sprayAlong(null);
assert.ok(legacy.dot(new THREE.Vector3(0,0,1))>0.99,`legacy muzzles stay on local -Z, got ${legacy.toArray()}`);
console.log(JSON.stringify({passed:true,cinder:cinder.toArray(),legacy:legacy.toArray()}));
