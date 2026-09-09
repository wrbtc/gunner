import {createGunnerStation} from './gunner-station.js?v=052';
import {agedAircraftMaterial} from './aircraft-surfaces.js?v=052';
import * as THREE from '../vendor/three.module.js?v=052';

export function upgradeGunBubble(craft,camera) {
  const frame=new THREE.Group();frame.name='Belly turret structural ring';craft.pitch.add(frame);
  const station=createGunnerStation(craft);
  const metal=agedAircraftMaterial('Worn bubble structural metal',0x616958,.48,.74,{wear:.9});
  const rubber=new THREE.MeshStandardMaterial({color:0x101316,roughness:.94});
  function mesh(geometry,material,position){const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.layers.set(1);frame.add(m);return m;}
  for(const side of [-1,1]){
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*1.62,-1.72,-1.65),new THREE.Vector3(side*2.30,-.42,-2.12),new THREE.Vector3(side*2.16,1.05,.8)]);
    mesh(new THREE.TubeGeometry(curve,24,.026,6,false),metal,[0,0,0]);
    const seal=mesh(new THREE.TubeGeometry(curve,24,.038,5,false),rubber,[side*.018,0,.012]);seal.renderOrder=1;
    const clamp=mesh(new THREE.BoxGeometry(.11,.24,.09),metal,[side*2.19,.88,.74]);clamp.rotation.z=side*.2;
  }
  const upper=new THREE.CatmullRomCurve3([new THREE.Vector3(-2.16,1.05,.8),new THREE.Vector3(0,1.78,1.7),new THREE.Vector3(2.16,1.05,.8)]);
  mesh(new THREE.TubeGeometry(upper,36,.064,7,false),metal,[0,0,0]);
  mesh(new THREE.BoxGeometry(.53,.36,.18),metal,[0,1.6,1.58]);
  const rivets=new THREE.InstancedMesh(new THREE.SphereGeometry(.028,6,4),metal,24),dummy=new THREE.Object3D();rivets.layers.set(1);
  for(let i=0;i<24;i++){const p=upper.getPoint(i/23);dummy.position.copy(p);dummy.position.z-=.065;dummy.updateMatrix();rivets.setMatrixAt(i,dummy.matrix);}frame.add(rivets);
  const lamp=mesh(new THREE.BoxGeometry(.14,.035,.08),new THREE.MeshBasicMaterial({color:0xffdcb0}),[0,1.39,1.45]);
  const workLight=new THREE.PointLight(0xffe3c7,5.2,6,1.7);workLight.position.set(0,.65,-1.5);workLight.layers.set(1);frame.add(workLight);
  const fill=new THREE.HemisphereLight(0xc3d6e4,0x272521,.82);fill.layers.set(1);frame.add(fill);
  for(const [i,g] of craft.guns.entries()){
    g.baseZ=-1.15;g.assembly.position.set((i?1:-1)*1.30,-.86,g.baseZ);g.assembly.scale.setScalar(.70);
    g.assembly.traverse(o=>{
      if(!o.isMesh)return;o.castShadow=false;
      // Recover the barrel/bracing read under the existing cockpit practical.
      // Keep every geometry, mount transform and aiming surface untouched.
      for(const material of Array.isArray(o.material)?o.material:[o.material]){
        if(material.name==='Parkerized charcoal steel'){material.color.setHex(0x344148);material.metalness=.79;material.roughness=.46;}
        if(material.name==='Rubbed steel edges'){material.color.setHex(0x697570);material.metalness=.86;material.roughness=.32;}
        if(material.name==='Worn olive-drab receiver paint'){material.color.setHex(0x414a3c);material.roughness=.77;}
      }
    });
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.23,1.1,7,1,true),new THREE.MeshBasicMaterial({color:0xffce8a,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));flame.position.set(0,.244,-4.75);flame.rotation.x=-Math.PI/2;flame.layers.set(1);g.assembly.add(flame);g.flameShape=flame;
  }
  frame.traverse(o=>o.layers.set(1));
  return {frame,workLight,station,reset(){for(const g of craft.guns){g.assembly.position.z=g.baseZ;g.flameShape.material.opacity=0;}}};
}
