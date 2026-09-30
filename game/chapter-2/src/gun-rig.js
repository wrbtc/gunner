import * as THREE from '../../vendor/three.module.js?v=052';

// The gunner's view from the seat: twin rotary guns in the lower corners, as in Chapter 1.
// They ride on the camera and draw last over a cleared depth buffer, so they never clip
// into a wall when you hug the statue.
export const GUN_LAYER=4;

function gatling(side,materials){
 const group=new THREE.Group();
 const housing=new THREE.Mesh(new THREE.CylinderGeometry(.17,.19,.72,18).rotateX(Math.PI/2),materials.metal);housing.position.z=-.12;
 const cradle=new THREE.Mesh(new THREE.BoxGeometry(.3,.12,.62),materials.dark);cradle.position.set(0,-.17,-.05);
 const ammo=new THREE.Mesh(new THREE.BoxGeometry(.3,.34,.46),materials.olive);ammo.position.set(side*.3,-.16,.12);
 const feed=new THREE.Mesh(new THREE.BoxGeometry(.2,.05,.34),materials.brass);feed.position.set(side*.16,-.02,.02);feed.rotation.z=side*.5;
 const barrels=new THREE.Group();barrels.position.z=-.5;
 for(let i=0;i<6;i++){
  const a=i/6*Math.PI*2,b=new THREE.Mesh(new THREE.CylinderGeometry(.027,.03,1.35,8).rotateX(Math.PI/2),materials.metal);
  b.position.set(Math.cos(a)*.085,Math.sin(a)*.085,-.62);barrels.add(b);
 }
 for(const z of [-.18,-.78,-1.22]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.12,.024,6,18),materials.dark);ring.position.z=z;barrels.add(ring);}
 const flash=new THREE.Mesh(new THREE.ConeGeometry(.2,.7,10,1,true).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial({color:0xffc070,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
 flash.position.z=-1.72;
 group.add(housing,cradle,ammo,feed,barrels,flash);
 return {group,barrels,flash};
}

// Metal reads lighter than real gunmetal on purpose: there is no reflection map, and true
// gunmetal renders as a black hole against the dark canyon.
export function createGunRig(camera){
 const materials={
  metal:new THREE.MeshStandardMaterial({color:0x6a716d,metalness:.3,roughness:.5}),
  dark:new THREE.MeshStandardMaterial({color:0x33393a,metalness:.3,roughness:.6}),
  olive:new THREE.MeshStandardMaterial({color:0x5f6645,metalness:.1,roughness:.75}),
  brass:new THREE.MeshStandardMaterial({color:0xb08a45,metalness:.7,roughness:.4})
 };
 const rig=new THREE.Group();rig.name='Seat guns';camera.add(rig);
 const guns=[-1,1].map(side=>{const g=gatling(side,materials);g.group.position.set(side*.56,-.5,-.34);g.group.scale.setScalar(.72);g.group.rotation.set(.04,side*.022,0);rig.add(g.group);return g;});
 rig.traverse(o=>o.layers.set(GUN_LAYER));
 let spin=0,spinSpeed=0,kick=0,flash=0,alternate=0;
 return {rig,
  // firing: gatling trigger held; shot(): one heavy round (cannon or Lance) for the kick.
  update(dt,{firing=false,gatling=false,overheated=false}={}){
   const target=firing&&gatling&&!overheated?38:0;
   spinSpeed+=(target-spinSpeed)*(1-Math.exp(-(target?9:2.2)*dt));spin+=spinSpeed*dt;
   kick=Math.max(0,kick-dt*5);flash=firing&&gatling&&!overheated?1:Math.max(0,flash-dt*14);alternate^=1;
   guns.forEach((g,i)=>{
    g.barrels.rotation.z=spin*(i?1:-1);
    g.group.position.z=-.34+kick*.12+(flash?Math.random()*.012:0);
    g.flash.material.opacity=flash?(i===alternate?.95:.35)*(.7+Math.random()*.3):0;
    g.flash.scale.setScalar(.8+Math.random()*.5);
   });
  },
  shot(){kick=1;},
  setVisible(v){rig.visible=v;}};
}
