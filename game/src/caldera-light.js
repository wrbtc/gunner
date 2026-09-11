import * as THREE from '../vendor/three.module.js?v=052';

// Original, deterministic radiance field. Convolving it once gives metal,
// lacquer and wet tissue a coherent sky to reflect without live cube cameras.
// The aperture matches the visible sky; the hot lower hemisphere is the river.
export function createCalderaEnvironment(renderer, scene) {
  const width=512,height=256,data=new Float32Array(width*height*4);
  const key=new THREE.Vector3(-.38,.43,-.82).normalize();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const phi=(x+.5)/width*Math.PI*2,theta=(y+.5)/height*Math.PI;
    const dy=-Math.cos(theta),dx=-Math.cos(phi)*Math.sin(theta),dz=-Math.sin(phi)*Math.sin(theta);
    const aperture=Math.pow(Math.max(0,dx*key.x+dy*key.y+dz*key.z),28);
    const sky=Math.max(0,dy),river=Math.pow(Math.max(0,-dy),3);
    const horizon=Math.exp(-Math.pow(dy*5,2));
    const i=(y*width+x)*4;
    data[i]=.042+sky*.14+aperture*3.8+river*.70-horizon*.019;
    data[i+1]=.052+sky*.20+aperture*4.8+river*.092-horizon*.023;
    data[i+2]=.070+sky*.30+aperture*6.0+river*.009-horizon*.031;
    data[i+3]=1;
  }
  let target=null,generation=0;
  function rebuild(){
    // Render-target pixels disappear on context loss. Retain the original CPU
    // radiance so a restored GPU receives a freshly convolved environment.
    const source=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);
    source.mapping=THREE.EquirectangularReflectionMapping;
    source.colorSpace=THREE.LinearSRGBColorSpace;source.needsUpdate=true;
    const generator=new THREE.PMREMGenerator(renderer);
    const replacement=generator.fromEquirectangular(source);
    replacement.texture.name='Convolved original caldera radiance';
    scene.environment=replacement.texture;target?.dispose();target=replacement;
    source.dispose();generator.dispose();generation++;
  }
  function release(){if(scene.environment===target?.texture)scene.environment=null;target?.dispose();target=null;}
  rebuild();
  // Dispose old-generation GL handles while the context is still lost. Three
  // replaces its property tables on restore; disposing afterward submits those
  // stale handles to the new context and causes INVALID_OPERATION.
  return {get texture(){return target?.texture||null;},get generation(){return generation;},rebuild,contextLost:release,dispose:release};
}
