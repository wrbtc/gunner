import * as THREE from '../vendor/three.module.js?v=052';
// An original heat-blasted remnant of human infrastructure. All structures sit
// beyond the protected canyon flight/support envelope; no route is displaced.
export function createBlastWorld({scene,centerAt,widthAt,bankMeshes}){
 const root=new THREE.Group();root.name='Perpetual blast: ruined viaduct and stripping ash';scene.add(root);
 let seed=81771;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const range=(a,b)=>a+(b-a)*random();
 const concrete=new THREE.MeshStandardMaterial({color:0x696151,roughness:.99,metalness:.01});
 concrete.onBeforeCompile=s=>{s.vertexShader='varying vec3 vRuin;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRuin=position;');s.fragmentShader='varying vec3 vRuin;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat scar=sin(vRuin.x*71.+sin(vRuin.z*23.)*4.)*sin(vRuin.y*39.);float pits=fract(sin(dot(floor(vRuin*95.),vec3(127.1,311.7,74.7)))*43758.5453);diffuseColor.rgb*=.63+pits*.38+scar*.08;`);};concrete.customProgramCacheKey=()=> 'scorched-concrete-1';
 const steel=new THREE.MeshStandardMaterial({color:0x292720,roughness:.81,metalness:.48});
 const box=new THREE.BoxGeometry(1,1,1,3,2,3),p=box.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),w=.04*Math.sin(x*37+z*11+y*71);p.setXYZ(i,x*(1+w),y+w*.3,z*(1+w));}box.computeVertexNormals();
 const slabs=new THREE.InstancedMesh(box,concrete,440),rebar=new THREE.InstancedMesh(new THREE.CylinderGeometry(.09,.12,1,5),steel,320);slabs.name='Heat-spalled concrete frames';rebar.name='Exposed torn reinforcement';let n=0,k=0;const dummy=new THREE.Object3D(),ray=new THREE.Raycaster();
 const put=(mesh,id,pos,scale,rot)=>{dummy.position.set(...pos);dummy.scale.set(...scale);dummy.rotation.set(...rot);dummy.updateMatrix();mesh.setMatrixAt(id,dummy.matrix);};
 for(let i=0;i<18;i++)for(const side of [-1,1]){const t=.035+i*.052,c=centerAt(t),x=c.x+side*(widthAt(t)+range(105,165)),z=c.z+range(-30,30);ray.set(new THREE.Vector3(x,500,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(bankMeshes.filter(m=>m.name.startsWith('bank-')),false)[0];const y=hit?hit.point.y:100;const h=range(24,70),lean=range(-.08,.08),turn=range(-.13,.13);
  for(const dx of [-8,8])put(slabs,n++,[x+dx,y+h*.5,z],[2.4,h,3],[lean,turn,side*.04]);
  const levels=2+i%3;for(let j=0;j<levels;j++){const height=y+7+j*(h-9)/levels;put(slabs,n++,[x+range(-3,3),height,z],[range(14,25),2.1,range(11,18)],[range(-.08,.08),turn,range(-.08,.08)]);}
  // Asymmetrically broken load path: one overhang and exposed reinforcement.
  put(slabs,n++,[x+side*12,y+h,z+range(-5,5)],[range(18,29),2.6,12],[0,turn,side*range(.04,.14)]);
  for(let j=0;j<7;j++)put(rebar,k++,[x+side*range(12,25),y+h+range(.3,2),z+(j-3)*1.1],[1,range(3,8),1],[range(.9,1.6),range(-.4,.4),range(-.5,.5)]);
 }
 slabs.count=n;rebar.count=k;for(const m of [slabs,rebar]){m.castShadow=true;m.receiveShadow=true;m.computeBoundingSphere();root.add(m);}
 const count=1500,positions=new Float32Array(count*3),phase=new Float32Array(count*4);for(let i=0;i<count;i++){phase[i*4]=random();phase[i*4+1]=random();phase[i*4+2]=random();phase[i*4+3]=random();}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const ash=new THREE.Points(geo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uReduced:{value:0}},vertexShader:'varying float vFade;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vFade=smoothstep(420.,100.,-mv.z)*smoothstep(2.,12.,-mv.z);gl_PointSize=clamp(110./max(1.,-mv.z),.7,3.);gl_Position=projectionMatrix*mv;}',fragmentShader:'varying float vFade;void main(){if(length(gl_PointCoord-.5)>.45)discard;gl_FragColor=vec4(.58,.49,.33,vFade*.45);}'}));ash.name='Wind-stripped ash';ash.frustumCulled=false;root.add(ash);
 function applyAshCap(off){ash.material.uniforms.uReduced.value=off?1:0;ash.visible=!off;geo.setDrawRange(0,off?0:count);}
 function update(time,plane,reduced){applyAshCap(!!reduced);slabs.visible=true;rebar.visible=true;if(reduced)return;const t=time;for(let i=0;i<count;i++){const j=i*4,o=i*3;positions[o]=plane.x+((phase[j]*600+t*(18+phase[j+3]*12))%600)-300;positions[o+1]=8+phase[j+1]*190+Math.sin(t*.3+phase[j]*20)*2;positions[o+2]=plane.z+((phase[j+2]*900-t*8)%900+900)%900-600;}geo.attributes.position.needsUpdate=true;}
 return{root,update,stats:()=>({concretePieces:n,exposedRebars:k,ashParticles:count,ashDrawn:ash.visible?count:0,ruinsVisible:slabs.visible})};
}
