import * as THREE from '../vendor/three.module.js?v=052';
import {createAshVolume} from './ash-volume.js?v=052';

// Direction-space atmosphere: the ash banks, opening and caldera silhouettes
// close at 360 degrees without a UV seam, pole pinch or lower-horizon curtain.
export function createHellSky(scene) {
  const densityVolume=createAshVolume();
  const uniforms = { uTime: { value: 0 },tAshVolume:{value:densityVolume} };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `varying vec3 vDirection;
      void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec3 vDirection;uniform float uTime;uniform highp sampler3D tAshVolume;
      float hash3(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float noise3(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float fbm(vec3 p){float n=0.,a=.55;for(int i=0;i<4;i++){n+=a*noise3(p);p=p*2.07+vec3(7.1,13.7,4.2);a*=.46;}return n;}
      float strata(vec2 a,float scale,float seed){
        vec3 p=vec3(a.x*scale,seed,a.y*scale);
        return noise3(p)*.67+noise3(p*2.71+vec3(9.,1.,17.))*.24+noise3(p*6.13)*.09;
      }
      float cloudField(vec3 p){
        // Large coherent forms dominate. Detail erodes their boundaries, so
        // small noise never covers the entire sky as a gray patterned sheet.
        float mass=fbm(p);
        float erosion=noise3(p*5.3+vec3(4.,11.,3.));
        return mass*.9+erosion*.1;
      }
      float volumeDensity(vec3 p){
        vec3 field=vec3(p.x,p.y*2.6,p.z);
        float mass=texture(tAshVolume,field*.085+vec3(.31,.47,.16)).r;
        float edge=texture(tAshVolume,field*.23+vec3(.11,.20,.79)).r;
        float altitude=smoothstep(1.35,1.62,p.y)*(1.-smoothstep(2.55,2.95,p.y));
        return max(0.,mass-.37-(edge-.5)*.13)*altitude*2.4;
      }
      void main(){
        vec3 d=normalize(vDirection);
        vec2 a=d.xz/max(.0001,length(d.xz));
        vec3 lightDirection=normalize(vec3(-.38,.43,-.82));
        float toLight=dot(d,lightDirection);
        float height=smoothstep(-.12,.86,d.y);
        vec3 color=mix(vec3(.051,.061,.076),vec3(.015,.024,.039),height);

        // One cold break in an otherwise heavy ceiling is the world's key
        // light. Its wide scattering stays dim; the compact core is occluded
        // by the foreground cloud field rather than drawn as a sun disk.
        float aperture=smoothstep(.93,.999,toLight);
        // The opening is one narrow fissure through the ceiling. Layered
        // occlusion keeps its pale core from turning into a white sky dome.
        aperture*=.68+.32*noise3(d*11.+vec3(3.,7.,11.));
        float core=pow(max(0.,toLight),156.);
        color+=vec3(.15,.21,.29)*aperture;
        color+=vec3(.65,.84,1.06)*core;

        // A high, translucent veil behind the nearer ash bank separates the
        // light well from the opaque, ragged cloud underside.
        vec3 drift=vec3(uTime*.0028,0.,-uTime*.0017);
        // Furnace light stays under the cloud deck, concentrated over the
        // active caldera. A small secondary glow preserves depth looking back.
        float furnace=pow(max(0.,dot(a,normalize(vec2(-.47,-.88)))),7.);
        float backFire=pow(max(0.,dot(a,normalize(vec2(.84,.54)))),14.)*.29;
        float underGlow=exp(-pow((d.y-.065)*4.9,2.))*(furnace+backFire);
        // Twelve staggered front-to-back samples through a finite ash layer. Two short
        // light probes give self-shadowed depth and illuminated ragged edges.
        // No history buffer, screen noise, new scene lights or opaque fog card.
        float enter=1.4/max(.055,d.y),leave=min(48.,2.9/max(.055,d.y));
        float stride=max(0.,leave-enter)/12.,transmittance=1.;vec3 cloudLight=vec3(0.);
        float rayOffset=.20+.60*hash3(d*719.);
        for(int i=0;i<12;i++){
          float distance=enter+(float(i)+rayOffset)*stride;vec3 p=d*distance;
          vec3 displaced=p+vec3(drift.x,0.,drift.z);
          float density=volumeDensity(displaced)*(1.-aperture*.33)*smoothstep(.025,.10,d.y);
          float extinction=1.-exp(-density*stride*1.45);
          float shadow=volumeDensity(displaced+lightDirection*.40)*.70+volumeDensity(displaced+lightDirection*.95)*1.10;
          float light=exp(-shadow*2.4);
          vec3 radiance=vec3(.027,.035,.048)+vec3(.21,.27,.36)*light*(.37+aperture*.9);
          radiance+=vec3(.083,.021,.003)*(1.-smoothstep(1.4,2.5,p.y))*underGlow;
          cloudLight+=transmittance*extinction*radiance;transmittance*=1.-extinction;
        }
        color=color*transmittance+cloudLight;
        color+=vec3(.035,.009,.001)*underGlow;

        // Broken caldera rims: different spatial scales and atmospheric values
        // make three distant masses, without polygonal zigzags or a horizon bar.
        // Fractured cone shoulders at different scales, with ridged upper
        // faces. Continuous direction coordinates preserve the 360° seam.
        float farRidge=1.-abs(2.*noise3(vec3(a.x*13.7,11.,a.y*13.7))-1.);
        float midRidge=1.-abs(2.*noise3(vec3(a.x*23.1,31.,a.y*23.1))-1.);
        float nearRidge=1.-abs(2.*noise3(vec3(a.x*37.2,53.,a.y*37.2))-1.);
        float farProfile=.011+pow(strata(a,4.7,11.),1.6)*.28+pow(farRidge,3.)*.025;
        float midProfile=-.061+pow(strata(a,8.1,31.),1.3)*.24+pow(midRidge,3.)*.023;
        float nearProfile=-.106+pow(strata(a,13.2,53.),1.2)*.205+pow(nearRidge,3.)*.016;
        float farMask=1.-smoothstep(farProfile-.0025,farProfile+.0025,d.y);
        float midMask=1.-smoothstep(midProfile-.0018,midProfile+.0018,d.y);
        float nearMask=1.-smoothstep(nearProfile-.0014,nearProfile+.0014,d.y);
        // Broad eroded faces stay subordinate to the nearer real geometry.
        // A vertical rill field gives directional erosion without contour-cell
        // outlines or a wallpaper grid on the distant silhouettes.
        float face=noise3(vec3(a.x*43.+d.y*6.,d.y*8.,a.y*43.));
        float sediment=noise3(vec3(a.x*13.,d.y*29.,a.y*13.));
        float upperSlope=smoothstep(-.01,farProfile,d.y);
        vec3 farRock=vec3(.059,.076,.101)*(.85+face*.16+sediment*.08+upperSlope*.06);
        farRock+=vec3(.017,.006,.001)*furnace;
        vec3 midRock=vec3(.040,.056,.077)*(.82+face*.20+sediment*.08);
        vec3 nearRock=vec3(.023,.035,.052)*(.80+face*.23+sediment*.08);
        color=mix(color,farRock,farMask);
        color=mix(color,midRock,midMask);
        color=mix(color,nearRock,nearMask);
        // Low ash is confined beneath the rims. Three distinct extinction
        // values keep the enormous caldera separate from the nearer gorge.
        color=mix(color,vec3(.042,.050,.061),exp(-pow((d.y+.035)*13.,2.))*.13);
        color=mix(color,vec3(.009,.012,.017),smoothstep(.13,.73,-d.y));
        gl_FragColor=vec4(max(color,vec3(0.)),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const geometry = new THREE.SphereGeometry(1950, 40, 24);
  const sky = new THREE.Mesh(geometry, material);
  sky.name = 'Occluded cold fissure through stratified ash and fractured caldera rims';
  sky.frustumCulled = false;
  // Opaque geometry writes depth first. The expensive atmosphere is shaded
  // only in its visible gaps; smoke and translucent tissue still blend later.
  sky.renderOrder = 1000;
  scene.add(sky);
  function setReducedEffects(value) {
    // Skip the 12-step volume march draw on the Intel integrated tier. Same
    // prepared program stays resident; visibility does not change light counts.
    sky.visible = !value;
  }
  return {
    update(time = 0, planePosition, reduced) {
      uniforms.uTime.value = Number.isFinite(time) ? time : 0;
      if (planePosition) sky.position.copy(planePosition);
      if (reduced !== undefined) setReducedEffects(reduced);
    },
    setReducedEffects,
    stats: () => ({ reduced: !sky.visible, visible: sky.visible, volumeSteps: sky.visible ? 12 : 0 }),
    dispose() { sky.removeFromParent(); geometry.dispose(); material.dispose(); densityVolume.dispose(); },
  };
}
