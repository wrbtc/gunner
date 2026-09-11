import * as THREE from '../vendor/three.module.js?v=052';

// A shared 256 KiB original periodic density volume. Trilinear hardware samples
// replace dozens of procedural hashes per ray-march step in the cloud ceiling.
export function createAshVolume(){
 const size=64,data=new Uint8Array(size*size*size);
 const h=(x,y,z)=>{let n=Math.imul(x+13,374761393)^Math.imul(y+19,668265263)^Math.imul(z+31,1597334677);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
 const mix=(a,b,t)=>a+(b-a)*t;
 function noise(x,y,z,n){
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let a=x-ix,b=y-iy,c=z-iz;
  a=a*a*(3-2*a);b=b*b*(3-2*b);c=c*c*(3-2*c);
  const at=(dx,dy,dz)=>h((ix+dx)%n,(iy+dy)%n,(iz+dz)%n);
  return mix(mix(mix(at(0,0,0),at(1,0,0),a),mix(at(0,1,0),at(1,1,0),a),b),mix(mix(at(0,0,1),at(1,0,1),a),mix(at(0,1,1),at(1,1,1),a),b),c);
 }
 for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,w=z/size;
  data[(z*size+y)*size+x]=Math.round(255*(noise(u*8,v*8,w*8,8)*.70+noise(u*16,v*16,w*16,16)*.22+noise(u*32,v*32,w*32,32)*.08));
 }
 const texture=new THREE.Data3DTexture(data,size,size,size);
 texture.name='Original periodic ash density';texture.format=THREE.RedFormat;
 texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.wrapS=texture.wrapT=texture.wrapR=THREE.RepeatWrapping;
 texture.unpackAlignment=1;texture.needsUpdate=true;return texture;
}
