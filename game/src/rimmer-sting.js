// Original flashbang-inspired presentation. No franchise audio or imagery.
// Digital peak bounds do not establish listening SPL; master volume/mute remain authoritative.
export const STING_SECONDS=5.2;
export const QUEEN_STING_SECONDS=3.2;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export function stingEnvelope(age,reduced=false,profile='rimmer'){
 const queen=profile==='queen',seconds=queen?QUEEN_STING_SECONDS:STING_SECONDS;
 if(!Number.isFinite(age)||age<0||age>=seconds)return{age,seconds,profile,active:false,bloom:0,heldOpacity:0,confusion:0,desaturation:0,worldGain:1,cutoff:20000};
 // Queen spikes retain their shorter v037 response. The Rimmer is the distinct
 // long concussion: sustained split contours, drained color and pressure loss.
 const recovery=clamp(1-age/seconds);
 const confusion=queen?recovery*recovery:1-smooth(.35,seconds,age);
 const bloom=queen?(.46*Math.exp(-age*7.4)+.09*recovery*recovery)*(reduced?.27:1):(reduced?(.49*Math.exp(-age*5.5)+.11*recovery*recovery)*.20:(.77*Math.exp(-age*3.9)+.15*recovery*recovery));
 const heldOpacity=queen?(1-smooth(.15,1.5,age))*(reduced?.15:.55):(1-smooth(reduced?.10:.38,reduced?1.8:3.8,age))*(reduced?.12:.66);
 const legacyGain=age<.15?.24:age<.42?.035:age<1.2?.12:.12+.88*clamp((age-1.2)/2);
 const worldGain=queen?legacyGain:reduced?.48+.52*smooth(.25,2.6,age):age<.10?.18:.04+.96*smooth(.65,seconds,age);
 const cutoff=queen?600+19400*Math.pow(clamp((age-.5)/2.7),2):reduced?2800+17200*smooth(.15,2.6,age):420+19580*Math.pow(smooth(.45,seconds,age),1.35);
 return{age,seconds,profile,active:true,bloom,heldOpacity,confusion,desaturation:confusion*(queen?(reduced?.12:.46):(reduced?.14:.80)),worldGain,cutoff};
}
export function stingBuffer(ctx,profile='rimmer'){
 const queen=profile==='queen',seconds=queen?QUEEN_STING_SECONDS:STING_SECONDS;
 const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*seconds),ctx.sampleRate),data=buffer.getChannelData(0);
 let seed=0x713ee,low=0,phase=0,peak=0;
 for(let i=0;i<data.length;i++){
  const t=i/ctx.sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296*2-1;low=low*.94+noise*.06;
  // Short inharmonic glass chip, then a distinct quiet pressure drop.
  let v=0;if(t<.16){const attack=Math.min(1,t/.004),env=attack*Math.exp(-t*40);v=env*(.32*Math.sin(t*2*Math.PI*1733)+.21*Math.sin(t*2*Math.PI*2417)+.10*Math.sin(t*2*Math.PI*3181)+noise*.13);}
  if(t>=.42){const u=t-.42;phase+=2*Math.PI*(46+92*Math.exp(-u*15))/ctx.sampleRate;const onset=Math.min(1,u/.012);v+=onset*(.31*Math.sin(phase)*Math.exp(-u*5.2)+low*2.1*Math.exp(-u*4));}
  // Soft low air tail, no continuous pure tinnitus tone.
  if(t>.70)v+=low*(queen?.10:.16)*Math.sin(Math.PI*clamp((t-.7)/(seconds-.7)))*Math.exp(-(t-.7)*(queen?.9:.42));
  data[i]=v*Math.min(1,(seconds-t)/.025);peak=Math.max(peak,Math.abs(data[i]));
 }
 const gain=.48/Math.max(.48,peak);for(let i=0;i<data.length;i++)data[i]*=gain;return buffer;
}
export function createStingFeedback({postMaterial,audio,reduced=()=>false,captureFrame}){
 let born=-Infinity,voice=null,buffer=null,bufferContext=null,bufferProfile=null,profile='rimmer';
 postMaterial.uniforms.uStingFrame={value:null};postMaterial.uniforms.uStingAge={value:100};postMaterial.uniforms.uStingReduced={value:0};postMaterial.uniforms.uStingBloom={value:0};postMaterial.uniforms.uStingHold={value:0};postMaterial.uniforms.uStingConfusion={value:0};postMaterial.uniforms.uStingDesaturation={value:0};postMaterial.uniforms.uStingQueen={value:0};
 if(!postMaterial.fragmentShader.includes('gl_FragColor=vec4(c,1.);'))throw Error('Sting requires the active cinematic composite');
 postMaterial.fragmentShader='uniform sampler2D uStingFrame;uniform float uStingAge,uStingReduced,uStingBloom,uStingHold,uStingConfusion,uStingDesaturation,uStingQueen;\n'+postMaterial.fragmentShader.replace('gl_FragColor=vec4(c,1.);',`
 if(uStingAge>=0.&&uStingAge<${STING_SECONDS.toFixed(1)}){
  float strength=uStingConfusion;
  float reduced=uStingReduced;vec2 axis=vec2(cos(uStingAge*.8),sin(uStingAge*.8));
  vec2 blur=axis*mix(.010,.008,uStingQueen)*strength*(1.-reduced),ghost=mix(vec2(.027,.008),vec2(.021,.006),uStingQueen)*strength*(1.-reduced);
  vec3 held=texture2D(uStingFrame,vUv).rgb;
  vec3 soft=held*.30;
  soft+=(texture2D(uStingFrame,clamp(vUv+blur,0.001,.999)).rgb+texture2D(uStingFrame,clamp(vUv-blur,0.001,.999)).rgb)*.18;
  soft+=(texture2D(uStingFrame,clamp(vUv+blur.yx,0.001,.999)).rgb+texture2D(uStingFrame,clamp(vUv-blur.yx,0.001,.999)).rgb)*.09;
  soft+=texture2D(uStingFrame,clamp(vUv+ghost,0.001,.999)).rgb*.16;
  // Live color always contributes at least34%; Rimmer reduced mode keeps88%.
  c=mix(c,mix(soft,held,reduced),uStingHold);
  float luma=dot(c,vec3(.2126,.7152,.0722));c=mix(c,vec3(luma),uStingDesaturation);
  float bloom=uStingBloom;
  float field=1.-smoothstep(.04,.8,length(vUv-vec2(.48,.53)));
  c=mix(c,vec3(.94,.96,1.),bloom*(.72+.28*field));
  // Violet-gray retinal veil and split contours decay continuously; no strobe.
  c=mix(c,vec3(.42,.39,.46),strength*.08*mix(1.,.35,reduced)*(1.-field));
 }
 gl_FragColor=vec4(c,1.);`);
 postMaterial.needsUpdate=true;
 function stopVoice(){if(!voice)return;voice.onended=null;try{voice.stop();}catch{}voice.disconnect();voice=null;}
 function perception(state,immediate=false){const ctx=audio.ctx;if(!ctx||!audio.perceptionGain||ctx.state==='closed')return;for(const [param,value]of [[audio.perceptionGain.gain,state.worldGain],[audio.perceptionFilter.frequency,state.cutoff]]){if(immediate){param.cancelScheduledValues(ctx.currentTime);param.setValueAtTime(value,ctx.currentTime);}else param.setTargetAtTime(value,ctx.currentTime,.015);}}
 function stats(){return {...stingEnvelope(performance.now()/1000-born,reduced(),profile),voiceActive:!!voice};}
 function update(){const state=stats();postMaterial.uniforms.uStingAge.value=state.active?state.age:100;postMaterial.uniforms.uStingReduced.value=reduced()?1:0;postMaterial.uniforms.uStingBloom.value=state.bloom;postMaterial.uniforms.uStingHold.value=state.heldOpacity;postMaterial.uniforms.uStingConfusion.value=state.confusion;postMaterial.uniforms.uStingDesaturation.value=state.desaturation;postMaterial.uniforms.uStingQueen.value=profile==='queen'?1:0;perception(state);if(!state.active)postMaterial.uniforms.uStingFrame.value=null;if(!state.active||audio.ctx?.state!=='running'||!audio.started)stopVoice();return state;}
 function impact(nextProfile='rimmer'){if(stats().active)return false;profile=nextProfile==='queen'?'queen':'rimmer';postMaterial.uniforms.uStingFrame.value=captureFrame();born=performance.now()/1000;const ctx=audio.ctx;
  if(ctx&&ctx.state==='running'&&audio.master){if(bufferContext!==ctx||bufferProfile!==profile){buffer=stingBuffer(ctx,profile);bufferContext=ctx;bufferProfile=profile;}stopVoice();voice=ctx.createBufferSource();voice.buffer=buffer;voice.connect(audio.master);const current=voice;voice.onended=()=>{current.disconnect();if(voice===current)voice=null;};voice.start();}
  update();return true;
 }
 function reset(){born=-Infinity;stopVoice();postMaterial.uniforms.uStingAge.value=100;postMaterial.uniforms.uStingBloom.value=0;postMaterial.uniforms.uStingHold.value=0;postMaterial.uniforms.uStingConfusion.value=0;postMaterial.uniforms.uStingDesaturation.value=0;postMaterial.uniforms.uStingFrame.value=null;perception(stingEnvelope(Infinity),true);}
 return{impact,update,reset,stats};
}

const trackingCache=new WeakMap();
export function trackingBuffer(ctx,kind='beep',urgency=0){
 const bin=Math.round(clamp(urgency)*7),key=kind+bin;
 if(!trackingCache.has(ctx))trackingCache.set(ctx,new Map());const cache=trackingCache.get(ctx);if(cache.has(key))return cache.get(key);
 const duration=kind==='lock'?.22:kind==='fire'?.16:.065,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),a=buffer.getChannelData(0);
 let seed=0x71ee+bin,phase=0;
 for(let i=0;i<a.length;i++){
  const t=i/ctx.sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296*2-1;
  const part=kind==='lock'?Math.floor(t/.11):0,u=kind==='lock'?t-part*.11:t;
  const gate=u<(kind==='lock'?.07:duration-.008)?1:0,freq=kind==='fire'?760-490*t/duration:kind==='lock'?640+part*320:920+bin*48;
  phase+=freq/ctx.sampleRate;const saw=2*(phase-Math.floor(phase)) -1,tri=2*Math.abs(saw)-1;
  const env=gate*Math.min(1,u/.003)*Math.min(1,(duration-t)/.008)*Math.exp(-u*(kind==='lock'?19:35));
  const clack=noise*Math.exp(-u*600)*.15;
  a[i]=(tri*.24+Math.sin(phase*2*Math.PI*1.503)*.13+clack)*env;
 }
 cache.set(key,buffer);return buffer;
}
