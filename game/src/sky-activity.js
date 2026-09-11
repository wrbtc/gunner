import * as THREE from '../vendor/three.module.js?v=052';

import {HP,POINTS,DRAGON_REPLACEMENT_METRES} from './combat-balance.js?v=052';
// Meteors remain scenery; wyverns have exact rendered-mesh hit tests.
// All poses are functions of presentation time: no integration or game RNG.
const TAU=Math.PI*2,UP=new THREE.Vector3(0,1,0);
const mod=(a,b)=>((a%b)+b)%b;
export function createSkyActivity(scene){
  const root=new THREE.Group();root.name='Falling fire and distant wyverns';scene.add(root);
  const heat=new THREE.ShaderMaterial({
    uniforms:{},vertexShader:`varying vec3 vP;varying vec3 vN;void main(){vP=position;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vP;varying vec3 vN;
      float h(vec3 p){return fract(sin(dot(p,vec3(17.1,83.7,41.3)))*43758.5);}
      float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 p=vP*3.1;float crust=n(p),fold=n(p*2.1+7.3);
        float leading=smoothstep(.04,.78,dot(normalize(vN),normalize(vec3(.12,-1.,.18))));
        float melt=leading*smoothstep(.34,.69,crust+fold*.17);
        float fissure=(1.-smoothstep(.022,.075,abs(crust-.48)))*smoothstep(.58,.78,fold)*leading;
        float face=.31+.69*max(0.,dot(normalize(vN),normalize(vec3(-1.,1.,2.))));
        vec3 c=vec3(.053,.063,.075)*face*(.63+crust*.68);
        c+=vec3(2.25,.38,.016)*(melt*.72+fissure*.30);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const flame=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:{uTime:{value:0}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uTime;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){
      float t=vUv.y;vec2 drift=vec2(vUv.x*5.2,t*7.-uTime*2.3);
      float folded=n(drift+vec2(n(drift*.7),0.)*.8)*.72+n(drift*2.07+11.3)*.28;
      float broken=smoothstep(.28,.73,folded);
      float edge=.35+.65*max(0.,sin(vUv.x*3.14159265));
      float a=pow(1.-t,2.3)*broken*edge*.24;
      vec3 c=mix(vec3(1.65,.34,.023),vec3(.24,.037,.009),smoothstep(0.,.70,t));
      gl_FragColor=vec4(c,a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const rockGeo=new THREE.IcosahedronGeometry(1,2);
  const rp=rockGeo.attributes.position;
  for(let i=0;i<rp.count;i++){
    const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i);
    const k=1+.12*Math.sin(x*17+y*7)*Math.cos(z*13-y*9);
    rp.setXYZ(i,x*k,y*k,z*k);
  }rockGeo.computeVertexNormals();
  const tailGeo=new THREE.ConeGeometry(1,1,9,12,true);tailGeo.translate(0,.5,0);
  const meteors=[];
  for(let i=0;i<6;i++){
    const group=new THREE.Group();group.name=`Incandescent falling boulder ${i+1}`;
    const rock=new THREE.Mesh(rockGeo,heat),tail=new THREE.Mesh(tailGeo,flame);
    const size=[13,10,15,9,11,12][i];rock.scale.set(size,size*.83,size*1.17);
    group.add(rock,tail);root.add(group);
    meteors.push({group,rock,tail,size,period:13+i*.93,phase:i*2.63+2.0,duration:7.4+i*.22});
  }
  const streaks=[];
  for(let i=0;i<3;i++){
    const group=new THREE.Group();group.name=`Distant cross-sky meteor ${i+1}`;
    const head=new THREE.Mesh(rockGeo,heat);head.scale.setScalar(2.5);
    const tail=new THREE.Mesh(tailGeo,flame);group.add(head,tail);root.add(group);
    streaks.push({group,tail,phase:i*6.4+4.2,period:19+i*2.7});
  }
  const silhouette=new THREE.MeshBasicMaterial({color:0x080b10,side:THREE.DoubleSide,fog:false});
  const bodyGeo=new THREE.SphereGeometry(1,10,7);
  function segment(parent,a,b,r){
    const curve=new THREE.LineCurve3(new THREE.Vector3(...a),new THREE.Vector3(...b));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,1,r,4,false),silhouette);parent.add(mesh);
  }
  function dragon(index){
    const group=new THREE.Group();group.name=`Distant dragon silhouette ${index+1}`;
    const body=new THREE.Mesh(bodyGeo,silhouette);body.scale.set(1.8,1.4,5.3);group.add(body);
    const neck=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,-3),new THREE.Vector3(0,1,-6),new THREE.Vector3(0,2,-8),new THREE.Vector3(0,1.4,-10)]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(neck,10,.8,5,false),silhouette));
    const head=new THREE.Mesh(bodyGeo,silhouette);head.position.set(0,1.5,-10.3);head.scale.set(.85,.72,1.8);group.add(head);
    segment(group,[-.55,2,-10],[ -1.2,3.2,-8.2],.26);segment(group,[.55,2,-10],[1.2,3.2,-8.2],.26);
    const tailRoot=new THREE.Group();tailRoot.position.z=3.3;group.add(tailRoot);
    const tailCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.5,-.3,4),new THREE.Vector3(2,-.6,9),new THREE.Vector3(4,.6,15)]);
    const tg=new THREE.TubeGeometry(tailCurve,18,.9,5,false),pos=tg.attributes.position;
    // Taper actual tail geometry to a whip, not a uniform tube.
    for(let ring=0;ring<=18;ring++){const center=tailCurve.getPointAt(ring/18),factor=1-ring/18*.97;for(let j=0;j<=5;j++){const n=ring*6+j;pos.setXYZ(n,center.x+(pos.getX(n)-center.x)*factor,center.y+(pos.getY(n)-center.y)*factor,center.z+(pos.getZ(n)-center.z)*factor);}}
    tg.computeVertexNormals();tailRoot.add(new THREE.Mesh(tg,silhouette));
    const wings=[];
    for(const side of [-1,1]){
      const pivot=new THREE.Group();pivot.position.set(side,0,-1.6);pivot.scale.x=side;group.add(pivot);
      const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(6,-4);s.lineTo(14,-5.2);s.lineTo(27,1.5);
      s.quadraticCurveTo(20,1,18,6);s.quadraticCurveTo(14,3.2,12,8.5);s.quadraticCurveTo(9,5.5,6,9.2);s.quadraticCurveTo(3,5.7,0,6);s.closePath();
      const geo=new THREE.ShapeGeometry(s,8);geo.rotateX(Math.PI/2);pivot.add(new THREE.Mesh(geo,silhouette));
      wings.push({pivot,side});
      segment(group,[side,0,2],[side*2.5,-2.2,4],.42);segment(group,[side*2.5,-2.2,4],[side*1.7,-2.7,6],.25);
    }
    group.scale.setScalar(index?1.03:1.35);root.add(group);return {id:'dragon-'+index+'-0',slot:index,generation:0,root:group,group,wings,tailRoot,hp:HP.dragon,dead:false,respawnAt:null,deathTime:null,deathRoll:0,deathWorld:new THREE.Vector3()};
  }
  const dragons=[dragon(0),dragon(1)],velocity=new THREE.Vector3();
  let lastTime=0,reducedState=false,combat=null;const ray=new THREE.Raycaster();
  function setCombat(options){combat=options;for(const d of dragons)combat.feedback?.register(d,[d.group]);}
  function trace(origin,direction,maxDistance){if(!root.visible)return null;root.updateWorldMatrix(true,true);ray.set(origin,direction);ray.near=0;ray.far=maxDistance;const meshes=[];for(const d of dragons)if(!d.dead&&d.group.visible)d.group.traverse(o=>{if(o.isMesh)meshes.push(o);});const h=ray.intersectObjects(meshes,false)[0];if(!h)return null;let node=h.object;while(node&&!dragons.some(d=>d.group===node))node=node.parent;const actor=dragons.find(d=>d.group===node);return{kind:'dragon',actor,distance:h.distance,point:h.point.clone(),normal:h.face.normal.clone().transformDirection(h.object.matrixWorld)};}
  function hit(d,point,damage){if(d.dead||!combat?.active())return false;d.hp=Math.max(0,d.hp-damage);combat.feedback?.hit(d);combat.audio?.confirmHit();combat.audio?.creature('dragon',point,false);if(d.hp)return false;d.dead=true;d.deathTime=lastTime;d.deathRoll=d.group.rotation.z;d.deathWorld.copy(d.group.getWorldPosition(new THREE.Vector3()));d.respawnAt=combat.distance()+DRAGON_REPLACEMENT_METRES;combat.award(POINTS.dragon,d);combat.audio?.creature('dragon',point,true);combat.explode?.(point,18);return true;}
  function reset(){for(const d of dragons){d.generation=0;d.id='dragon-'+d.slot+'-0';d.hp=HP.dragon;d.dead=false;d.respawnAt=d.deathTime=null;d.group.visible=true;d.hitFlash=0;}}
  function update(time,planePosition,reduced=false){
    const t=Number.isFinite(time)?Math.max(0,time):0;lastTime=t;reducedState=!!reduced;
    if(planePosition)root.position.copy(planePosition);
    flame.uniforms.uTime.value=reduced?0:t;
    meteors.forEach((m,i)=>{
      const age=mod(t+m.phase,m.period);m.group.visible=!reduced&&age<m.duration;
      const a=age/m.duration,side=i%2?-1:1;
      m.group.position.set([-140,200,-400,90,480,-90][i]+side*age*13,640-age*35-age*age*4.4,[-650,-900,-1050,-760,-1350,-1150][i]);
      m.rock.rotation.set(t*(.29+i*.031),t*.37+i,t*.17);
      velocity.set(-side*13,35+age*8.8,0).normalize();m.tail.quaternion.setFromUnitVectors(UP,velocity);
      m.tail.scale.set(m.size*.83,72+age*13,m.size*.83);
      // Fade-in by scale while still high above the rim; no abrupt bright pop.
      const envelope=THREE.MathUtils.smoothstep(a,0,.10)*(1-THREE.MathUtils.smoothstep(a,.86,1));
      m.group.scale.setScalar(Math.max(.00001,envelope));
    });
    streaks.forEach((s,i)=>{
      const age=mod(t+s.phase,s.period),duration=4.6;s.group.visible=!reduced&&age<duration;
      const side=i%2?-1:1;
      s.group.position.set(side*(-1150+age*490),470+i*110-age*24,-1250-i*100);
      velocity.set(-side*490,24,0).normalize();s.tail.quaternion.setFromUnitVectors(UP,velocity);s.tail.scale.set(2.8,210,2.8);
      s.group.scale.setScalar(Math.max(.00001,Math.sin(Math.PI*Math.min(1,age/duration))));
    });
    dragons.forEach((d,i)=>{
      if(d.dead&&combat?.distance()>=d.respawnAt){d.dead=false;d.hp=HP.dragon;d.generation++;d.id='dragon-'+i+'-'+d.generation;d.hitFlash=0;d.group.visible=true;combat.log?.('dragon-replacement',{source:d.id,distance:combat.distance()});}
      if(d.dead){const age=t-d.deathTime;d.group.visible=age<2.5;d.group.position.copy(d.deathWorld).sub(root.position);d.group.position.y-=age*age*18;d.group.rotation.z=d.deathRoll+age*1.5;for(const {pivot,side}of d.wings)pivot.rotation.z=side*1.15;return;}
      d.group.visible=true;const phase=t*.070+i*2.8+d.generation*.4,x=Math.sin(phase)*(i?310:240),z=-470+Math.cos(phase)*(i?80:100);
      d.group.position.set(x,165+i*35+Math.sin(t*.12+i*2)*13,z);
      // Long glides and short asymmetric wing beats, with a soft banking arc.
      const dx=Math.cos(phase)*(i?310:240),dz=-Math.sin(phase)*(i?80:100);
      d.group.rotation.set(0,Math.atan2(-dx,-dz),Math.sin(phase)*.16);
      const cycle=mod(t+i*4.7,11),beat=cycle<4.8?Math.sin(cycle/4.8*TAU*2)*Math.sin(cycle/4.8*Math.PI):0;
      for(const {pivot,side} of d.wings)pivot.rotation.z=side*(.12+(reduced?0:beat*.40));
      d.tailRoot.rotation.y=Math.sin(t*.7+i)*.10;
    });
  }
  update(0);
  return {root,update,setCombat,trace,hit,reset,dragons,stats:()=>({time:lastTime,reduced:reducedState,meteorPool:meteors.length,streakPool:streaks.length,dragons:dragons.length,livingDragons:dragons.filter(d=>!d.dead).length,combat:dragons.map(d=>({id:d.id,hp:d.hp,dead:d.dead,respawnAt:d.respawnAt,generation:d.generation})),visibleMeteors:meteors.filter(m=>m.group.visible).length,visibleStreaks:streaks.filter(s=>s.group.visible).length,poses:root.children.map(o=>({name:o.name,visible:o.visible,position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray()}))})};
}
