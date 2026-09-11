import * as THREE from '../vendor/three.module.js?v=052';

// One HDR/output transform for both the world and the gun bubble.
// Bloom is evaluated at quarter resolution; the aiming image stays full resolution.
export function createCinematicPass(renderer) {
  const quality={heat:true,contact:true};
  let reducedEffectsActive=false;
  const options={type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false};
  const hdr=new THREE.WebGLRenderTarget(1,1,{...options,depthBuffer:true,samples:4});
  hdr.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  const contact=new THREE.WebGLRenderTarget(1,1,{...options,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const contactPing=contact.clone();
  const shaded=new THREE.WebGLRenderTarget(1,1,options);
  const ping=new THREE.WebGLRenderTarget(1,1,options),pong=new THREE.WebGLRenderTarget(1,1,options);
  for(const target of [hdr,ping,pong])target.texture.colorSpace=THREE.LinearSRGBColorSpace;
  const quadScene=new THREE.Scene(),quadCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const material=(uniforms,fragment)=>new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,depthTest:false,depthWrite:false,toneMapped:false});
  const occlusion=material({tDepth:{value:hdr.depthTexture},uInverseProjection:{value:new THREE.Matrix4()},uResolution:{value:new THREE.Vector2(1,1)},uProjection:{value:1},uScale:{value:1}},`
    varying vec2 vUv;uniform sampler2D tDepth;uniform mat4 uInverseProjection;uniform vec2 uResolution;uniform float uProjection,uScale;
    vec3 viewAt(vec2 uv){float z=texture2D(tDepth,uv).r;vec4 p=uInverseProjection*vec4(uv*2.-1.,z*2.-1.,1.);return p.xyz/p.w;}
    void main(){
      float depth=texture2D(tDepth,vUv).r;vec3 p=viewAt(vUv);
      if(depth>.999999){gl_FragColor=vec4(1.,1.,0.,1.);return;}
      vec2 pixel=3./uResolution;
      vec3 dx1=viewAt(vUv+vec2(pixel.x,0.))-p,dx2=p-viewAt(vUv-vec2(pixel.x,0.));
      vec3 dy1=viewAt(vUv+vec2(0.,pixel.y))-p,dy2=p-viewAt(vUv-vec2(0.,pixel.y));
      vec3 n=normalize(cross(abs(dx1.z)<abs(dx2.z)?dx1:dx2,abs(dy1.z)<abs(dy2.z)?dy1:dy2));
      float radius=clamp(1.8-p.z*.012,1.8,6.)*uScale;
      float screenRadius=clamp(radius*uProjection/max(1.,-p.z)*.5,2./uResolution.y,36./uResolution.y);
      float obscured=0.;
      float rotation=fract(sin(dot(floor(vUv*uResolution*.5),vec2(12.9898,78.233)))*43758.5453)*6.2831853;
      for(int i=0;i<8;i++){
        float angle=(float(i)+.25)*.78539816+rotation;
        float ring=mix(.43,1.,mod(float(i),2.));
        vec2 offset=vec2(cos(angle)*uResolution.y/uResolution.x,sin(angle))*screenRadius*ring;
        vec3 delta=viewAt(clamp(vUv+offset,pixel,1.-pixel))-p;
        float distance=length(delta);
        float horizon=max(0.,dot(n,delta/max(.0001,distance))-.18);
        obscured+=horizon*(1.-smoothstep(radius*.15,radius,distance));
      }
      gl_FragColor=vec4(clamp(1.-obscured*.19,.58,1.),clamp(-p.z/4096.,0.,1.),0.,1.);
    }`);
  const contactBlur=material({tContact:{value:contact.texture},uDirection:{value:new THREE.Vector2()}},`
    varying vec2 vUv;uniform sampler2D tContact;uniform vec2 uDirection;
    void main(){vec2 center=texture2D(tContact,vUv).rg;float sum=center.r*.375,total=.375;
      for(int i=1;i<=2;i++)for(int side=-1;side<=1;side+=2){
        vec2 sampleValue=texture2D(tContact,vUv+uDirection*float(i*side)).rg;
        float weight=(i==1?.25:.0625)*exp(-abs(sampleValue.g-center.g)/max(.000025,center.g*.006));
        sum+=sampleValue.r*weight;total+=weight;
      }
      gl_FragColor=vec4(sum/total,center.g,0.,1.);
    }`);
  const contactComposite=material({tImage:{value:hdr.texture},tContact:{value:contact.texture},tDepth:{value:hdr.depthTexture},uInverseProjection:{value:occlusion.uniforms.uInverseProjection.value},uContactSize:{value:new THREE.Vector2(1,1)}},`
    varying vec2 vUv;uniform sampler2D tImage,tContact,tDepth;uniform mat4 uInverseProjection;uniform vec2 uContactSize;
    void main(){
      float z=texture2D(tDepth,vUv).r;vec4 p=uInverseProjection*vec4(vUv*2.-1.,z*2.-1.,1.);float depth=-p.z/p.w;
      vec2 cell=vUv*uContactSize-.5,origin=floor(cell),f=fract(cell);float sum=0.,total=0.;
      for(int i=0;i<4;i++){
        vec2 corner=vec2(mod(float(i),2.),floor(float(i)*.5));
        vec2 value=texture2D(tContact,(origin+corner+.5)/uContactSize).rg;
        vec2 blend=mix(1.-f,f,corner);float w=blend.x*blend.y*exp(-abs(value.g*4096.-depth)/max(.35,depth*.006));
        sum+=value.r*w;total+=w;
      }
      float shade=total>.0001?sum/total:1.;vec3 c=texture2D(tImage,vUv).rgb;
      // Preserve self-lit lava/weapon telegraphs while grounding opaque mass.
      float hot=smoothstep(1.1,3.,max(c.r,max(c.g,c.b)));c*=mix(shade,1.,hot);
      gl_FragColor=vec4(c,1.);
    }`);
  const copy=material({tImage:{value:shaded.texture}},'varying vec2 vUv;uniform sampler2D tImage;void main(){gl_FragColor=texture2D(tImage,vUv);}');
  const extract=material({tImage:{value:hdr.texture}},`varying vec2 vUv;uniform sampler2D tImage;void main(){vec3 c=texture2D(tImage,vUv).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(.82,2.4,l),1.);}`);
  const blur=material({tImage:{value:ping.texture},uDirection:{value:new THREE.Vector2()}},`varying vec2 vUv;uniform sampler2D tImage;uniform vec2 uDirection;void main(){vec3 c=texture2D(tImage,vUv).rgb*.227027;c+=(texture2D(tImage,vUv+uDirection*1.384615).rgb+texture2D(tImage,vUv-uDirection*1.384615).rgb)*.316216;c+=(texture2D(tImage,vUv+uDirection*3.230769).rgb+texture2D(tImage,vUv-uDirection*3.230769).rgb)*.07027;gl_FragColor=vec4(c,1.);}`);
  const composite=material({tImage:{value:hdr.texture},tBloom:{value:ping.texture},uTime:{value:0},uHeat:{value:.00065},uExposure:{value:1.13}},`
    varying vec2 vUv;uniform sampler2D tImage,tBloom;uniform float uTime,uHeat,uExposure;
    vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
    vec3 toSRGB(vec3 x){return mix(x*12.92,1.055*pow(x,vec3(1./2.4))-.055,step(vec3(.0031308),x));}
    void main(){float lower=1.-smoothstep(.1,.63,vUv.y);vec2 uv=vUv+vec2(sin(vUv.y*89.+uTime*2.2+sin(vUv.x*26.+uTime)),sin(vUv.x*40.+uTime)*.2)*lower*uHeat;
      vec3 c=texture2D(tImage,uv).rgb;vec3 bloom=texture2D(tBloom,vUv).rgb;
      c+=bloom*.20;float edge=dot((vUv-.5)*vec2(1.,.8),(vUv-.5)*vec2(1.,.8));c*=1.-edge*.25;
      c=aces(c*uExposure);c=toSRGB(c);gl_FragColor=vec4(c,1.);
    }`);
  const freezeCopy=material({...composite.uniforms},composite.fragmentShader);
  const frozenFrame=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false});
  let snapshotSerial=0,stingRecoveryPending=false;
  function captureStingFrame(){const previous=renderer.getRenderTarget(),oldMaterial=quad.material;frozenFrame.setSize(width,height);draw(freezeCopy,frozenFrame);renderer.setRenderTarget(previous);quad.material=oldMaterial;snapshotSerial++;return frozenFrame.texture;}
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),extract);quadScene.add(quad);
  let width=1,height=1;
  function resize(){const size=renderer.getDrawingBufferSize(new THREE.Vector2());if(size.x===width&&size.y===height)return;width=size.x;height=size.y;hdr.setSize(width,height);shaded.setSize(width,height);contact.setSize(Math.max(1,width>>1),Math.max(1,height>>1));contactPing.setSize(contact.width,contact.height);occlusion.uniforms.uResolution.value.set(width,height);contactComposite.uniforms.uContactSize.value.set(contact.width,contact.height);ping.setSize(Math.max(1,width>>2),Math.max(1,height>>2));pong.setSize(Math.max(1,width>>2),Math.max(1,height>>2));}
  function draw(mat,target){quad.material=mat;renderer.setRenderTarget(target);renderer.render(quadScene,quadCamera);}
  function applyContact(camera,scale=1){
    occlusion.uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
    occlusion.uniforms.uProjection.value=camera.projectionMatrix.elements[5];occlusion.uniforms.uScale.value=scale;
    draw(occlusion,contact);
    contactBlur.uniforms.tContact.value=contact.texture;contactBlur.uniforms.uDirection.value.set(1/contact.width,0);draw(contactBlur,contactPing);
    contactBlur.uniforms.tContact.value=contactPing.texture;contactBlur.uniforms.uDirection.value.set(0,1/contact.height);draw(contactBlur,contact);
    draw(contactComposite,shaded);
    renderer.autoClear=false;draw(copy,hdr);renderer.autoClear=true;
  }
  let preparedPrograms=0,preparedPointLightCounts=[],contextGeneration=0,preparation=null;
  let preparationStatus={stage:'idle',completed:0,total:0};
  function prepare(scene,camera,{reveal=[],lightVariants=null,onProgress,timeoutMs=30000}={}){
    const generation=contextGeneration,gl=renderer.getContext();
    if(gl.isContextLost())return Promise.resolve(false);
    if(preparation?.generation===generation){
      if(preparation.scene!==scene||preparation.camera!==camera)return Promise.reject(Object.assign(new Error('Graphics preparation already running'),{code:'PREPARATION_BUSY'}));
      if(onProgress)preparation.listeners.add(onProgress);
      return preparation.promise;
    }
    const entry={generation,scene,camera,listeners:new Set(onProgress?[onProgress]:[])};
    preparation=entry;preparedPrograms=0;preparedPointLightCounts=[];
    const report=(stage,completed,total,detail=null)=>{
      if(preparation!==entry)return;
      preparationStatus={stage,completed,total,...(detail||{})};
      // Observers cannot change whether graphics preparation succeeds.
      for(const listener of entry.listeners)try{listener({...preparationStatus});}catch{}
    };
    async function run(){
      const started=performance.now(),deadline=started+timeoutMs,roots=lightVariants?.roots||[],maximum=lightVariants?.maxVisible??0;
      const programs=new Set(),finished=new Set(),pointLightCounts=new Set();
      // Keep the hot path to counters and clock reads. The bounded program list,
      // context query and report object are created once, only if preparation fails.
      const diag={
        lastPhase:'init',lastCompletedPhase:null,variant:null,layer:null,
        jobIndex:null,totalJobs:0,batchIndex:null,jobBatchCount:0,
        submittedObjects:0,totalObjects:0,
        maxCompileMs:0,recentCompileMs:0,maxReadyPollMs:0,recentReadyPollMs:0,
        maxUniformsMs:0,recentUniformsMs:0,maxAttributesMs:0,recentAttributesMs:0,
        maxIntrospectMs:0,recentIntrospectMs:0,parallelCompile:null,compilerNote:null
      };
      const setPhase=(phase,extra={})=>{Object.assign(diag,{lastPhase:phase,...extra});};
      const recordTiming=(kind,ms)=>{diag[`recent${kind}Ms`]=ms;if(ms>diag[`max${kind}Ms`])diag[`max${kind}Ms`]=ms;};
      const timed=(phase,kind,work)=>{setPhase(phase);const before=performance.now();try{return work();}finally{recordTiming(kind,performance.now()-before);}};
      const pendingIds=()=>{
        const ids=[];
        for(const program of programs){if(!finished.has(program)){ids.push(String(program?.id??'?').slice(0,48));if(ids.length===24)break;}}
        return ids;
      };
      const contextLost=()=>{try{return !!gl.isContextLost();}catch{return null;}};
      const snapshot=error=>({
        lastPhase:diag.lastPhase,lastCompletedPhase:diag.lastCompletedPhase,
        variant:diag.variant,layer:diag.layer,jobIndex:diag.jobIndex,totalJobs:diag.totalJobs,
        batchIndex:diag.batchIndex,jobBatchCount:diag.jobBatchCount,
        submittedObjects:diag.submittedObjects,totalObjects:diag.totalObjects,
        discoveredPrograms:programs.size,finishedPrograms:finished.size,pendingProgramIds:pendingIds(),
        elapsedMs:Math.round(performance.now()-started),
        maxCompileMs:Math.round(diag.maxCompileMs),recentCompileMs:Math.round(diag.recentCompileMs),
        maxReadyPollMs:Math.round(diag.maxReadyPollMs),recentReadyPollMs:Math.round(diag.recentReadyPollMs),
        maxUniformsMs:Math.round(diag.maxUniformsMs),recentUniformsMs:Math.round(diag.recentUniformsMs),
        maxAttributesMs:Math.round(diag.maxAttributesMs),recentAttributesMs:Math.round(diag.recentAttributesMs),
        maxIntrospectMs:Math.round(diag.maxIntrospectMs),recentIntrospectMs:Math.round(diag.recentIntrospectMs),
        contextLost:contextLost(),parallelCompile:diag.parallelCompile,compilerNote:diag.compilerNote,
        exceptionCode:String(error?.code||'PREPARATION_FAILED').slice(0,80),
        exceptionMessage:String(error?.message||error||'Flight preparation failed').slice(0,160)
      });
      const canceled=()=>generation!==contextGeneration||gl.isContextLost();
      const timeoutError=()=>Object.assign(new Error('Graphics preparation timed out'),{code:'PREPARATION_TIMEOUT'});
      function assertTime(){
        if(performance.now()-started>=timeoutMs)throw timeoutError();
      }
      // Serial getUniforms/getAttributes can cost ~200ms each on weak integrated
      // GL. Yield before another introspect once this slice is spent, and skip
      // remaining first-use queries when they would consume the graphics wall.
      // Linked programs still count as finished; Three warms locations on draw.
      let skipIntrospect=false,introspectTotalMs=0,remainingJobs=[];
      const batchesFor=job=>Math.ceil(Math.max(1,job.objects.length)/16);
      const estimatedIntrospectMs=()=>Math.max(8,diag.recentUniformsMs+diag.recentAttributesMs);
      const remainingMs=()=>deadline-performance.now();
      const queuedCompileMs=()=>remainingJobs.reduce((sum,queued)=>sum+batchesFor(queued),0)*Math.max(1,diag.recentCompileMs);
      const noteDeferredUniforms=()=>{if(diag.compilerNote!=='conserved-light-variants')diag.compilerNote='deferred-uniforms';};
      function canAffordIntrospect(){
        const remaining=remainingMs()-queuedCompileMs(),estimate=estimatedIntrospectMs();
        return remaining>Math.max(timeoutMs*0.1,estimate)&&introspectTotalMs<timeoutMs*0.5;
      }
      function throwIfBlockingCallExceeded(ms){
        if(performance.now()-started>=timeoutMs&&ms>=timeoutMs)throw timeoutError();
      }
      function considerSkipIntrospect(){
        if(skipIntrospect)return true;
        if(canAffordIntrospect())return false;
        skipIntrospect=true;noteDeferredUniforms();return true;
      }
      // A timer cannot interrupt an individual blocking driver call. Small
      // batches limit our own synchronous work and expose progress between them.
      // Message tasks yield without the nested setTimeout minimum delay, which
      // otherwise adds seconds across a large scene. Own one channel per run.
      const yieldChannel=typeof MessageChannel==='function'?new MessageChannel():null;
      let resumeYield=null;
      if(yieldChannel)yieldChannel.port1.onmessage=()=>{const resolve=resumeYield;resumeYield=null;resolve?.();};
      const yieldTask=()=>new Promise(resolve=>{
        if(yieldChannel){resumeYield=resolve;yieldChannel.port2.postMessage(0);}
        else setTimeout(resolve,0);
      });
      function selection(objects){
        // compile's third argument supplies the real lights/fog/environment.
        // Its first argument supplies only material-bearing objects on this
        // camera layer. No reparenting, cloning, or duplicate lights occurs.
        return {traverse:visit=>{for(const object of objects)visit(object);},traverseVisible(){}};
      }
      const objectsForLayer=layer=>{
        const objects=[],mask=1<<layer;
        scene.traverse(object=>{if(object.material&&(object.layers.mask&mask)!==0)objects.push(object);});
        return objects;
      };
      const visibilityObjects=[...new Set([...reveal,...roots])];
      function withLightState(job,work){
        const previousMask=camera.layers.mask,visibility=visibilityObjects.map(object=>[object,object.visible]);
        try{
          if(!job.capture){
            if(job.revealed!==null)for(const object of reveal)object.visible=job.revealed;
            if(lightVariants)roots.forEach((root,index)=>{root.visible=index<job.count;});
            camera.layers.set(job.layer);
          }
          return work();
        }finally{
          for(const [object,visible]of visibility)object.visible=visible;
          camera.layers.mask=previousMask;
        }
      }
      function lightSignature(job){
        return withLightState(job,()=>{
          let plainPoints=0;const otherLights=[];
          scene.traverseVisible(light=>{
            if(!light.isLight||!light.layers.test(camera.layers))return;
            // Only ordinary unshadowed PointLight identities are interchangeable
            // for shader compilation. Keep other types, shadow lights and maps
            // identity-bound, even when their shader counts could be equivalent.
            if(light.isPointLight&&!light.castShadow&&!light.map)plainPoints++;
            else otherLights.push([light.id,light.type,!!light.castShadow,light.map?.id??null]);
          });
          return JSON.stringify([job.layer,plainPoints,otherLights]);
        });
      }
      function submit(job,objects){
        const previousTarget=renderer.getRenderTarget(),previousMaterial=quad.material;
        const compileStarted=performance.now();
        try{
          return withLightState(job,()=>{
            if(job.capture){quad.material=freezeCopy;renderer.setRenderTarget(frozenFrame);}
            else{
              renderer.setRenderTarget(hdr);
              if(job.layer===0){let count=0;scene.traverseVisible(object=>{if(object.isPointLight&&object.layers.test(camera.layers))count++;});pointLightCounts.add(count);}
            }
            const source=job.capture?quadScene:scene,view=job.capture?quadCamera:camera;
            for(const material of renderer.compile(selection(objects),view,source)){
              for(const program of renderer.properties.get(material).programs.values())programs.add(program);
            }
          });
        }finally{
          recordTiming('Compile',performance.now()-compileStarted);
          if(diag.parallelCompile===null){try{diag.parallelCompile=!!gl.getExtension?.('KHR_parallel_shader_compile');}catch{diag.parallelCompile=null;}}
          quad.material=previousMaterial;renderer.setRenderTarget(previousTarget);
        }
      }
      try{
        if(!Number.isInteger(maximum)||maximum<0||maximum>roots.length)throw new TypeError('Invalid light visibility bound');
        if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new TypeError('Invalid graphics preparation timeout');
        const world=objectsForLayer(0),cockpit=objectsForLayer(1),plannedJobs=[];
        for(const revealed of reveal.length?[lightVariants?false:null,true]:[null]){
          for(let count=0;count<=(lightVariants?maximum:0);count++)plannedJobs.push({layer:0,count,revealed,objects:world});
          plannedJobs.push({layer:1,count:lightVariants?maximum:0,revealed,objects:cockpit});
        }
        // Within this call every job on one layer uses the same original
        // objects/material layouts, HDR target, fog and environment. Visibility
        // changes only select lights: skip equal conservative light signatures.
        // Do not deduplicate materials, objects, different layers or captures.
        const signatures=new Set(),jobs=[];
        for(const job of plannedJobs){const signature=lightSignature(job);if(!signatures.has(signature)){signatures.add(signature);jobs.push(job);}}
        jobs.push({capture:true,objects:[quad]});
        let total=jobs.reduce((sum,job)=>sum+job.objects.length,0);let submitted=0;
        diag.totalJobs=jobs.length;diag.totalObjects=total;diag.submittedObjects=0;
        setPhase('submit',{jobIndex:0,batchIndex:0});
        report('submit',0,total);await yieldTask();
        if(canceled()){report('canceled',0,total);return false;}assertTime();resize();
        remainingJobs=jobs.slice();
        let jobIndex=0,conserved=false;
        while(remainingJobs.length){
          const job=remainingJobs.shift(),jobBatchCount=batchesFor(job);
          Object.assign(diag,{jobIndex,jobBatchCount,layer:job.capture?null:job.layer,variant:job.capture?'capture':`L${job.layer}:c${job.count}:r${job.revealed}`});
          // Each compile call has at most sixteen original objects. Even empty
          // worlds pass through submit so actual light-count coverage is recorded.
          for(let offset=0,batchIndex=0;offset<Math.max(1,job.objects.length);offset+=16,batchIndex++){
            if(canceled()){report('canceled',submitted,total);return false;}assertTime();
            setPhase('compile',{batchIndex});
            const objects=job.objects.slice(offset,offset+16);submit(job,objects);assertTime();
            submitted+=objects.length;diag.submittedObjects=submitted;diag.lastCompletedPhase='compile';
            // Weak serial compilers (missing KHR_parallel_shader_compile, or a
            // blocking compile of 16ms+) cannot finish every plasma light-count
            // variant inside the graphics budget. Keep the in-flight job, the
            // fullest remaining world and cockpit counts, and capture.
            if(!conserved&&remainingJobs.length){
              const compileMs=Math.max(diag.maxCompileMs,diag.recentCompileMs);
              const compileLooksSerial=diag.parallelCompile===false||compileMs>=16;
              const currentLeft=Math.max(0,job.objects.length-(offset+objects.length));
              const remainingWork=(Math.ceil(currentLeft/16)+remainingJobs.reduce((sum,queued)=>sum+batchesFor(queued),0))*Math.max(1,compileMs);
              if(compileLooksSerial&&remainingWork>Math.max(0,deadline-performance.now())*0.8){
                conserved=true;
                const keep=[],lastWorld=[...remainingJobs].reverse().find(queued=>!queued.capture&&queued.layer===0);
                const lastCockpit=[...remainingJobs].reverse().find(queued=>!queued.capture&&queued.layer===1);
                const capture=remainingJobs.find(queued=>queued.capture);
                for(const queued of [lastWorld,lastCockpit,capture])if(queued&&!keep.includes(queued))keep.push(queued);
                remainingJobs.length=0;remainingJobs.push(...keep);
                total=submitted+currentLeft+remainingJobs.reduce((sum,queued)=>sum+queued.objects.length,0);
                diag.totalObjects=total;diag.totalJobs=jobIndex+1+remainingJobs.length;diag.compilerNote='conserved-light-variants';
              }
            }
            report('submit',submitted,total);await yieldTask();
          }
          // Finish this variant before adding another queue of shader work.
          let pending=[...programs].filter(program=>!finished.has(program)),stalledPolls=0;
          while(pending.length){
            if(canceled()){report('canceled',finished.size,programs.size);return false;}assertTime();
            const begin=performance.now(),previousFinished=finished.size;let visited=0;
            for(const program of pending){
              if(canceled())break;assertTime();
              const ready=timed('link-ready-poll','ReadyPoll',()=>program.isReady());
              assertTime();diag.lastCompletedPhase='link-ready-poll';
              if(ready){
                // Do not start another blocking query once this slice is spent.
                if(visited>0&&performance.now()-begin>=4)break;
                if(considerSkipIntrospect())finished.add(program);
                else{
                  const introspectStarted=performance.now();
                  try{
                    timed('uniforms','Uniforms',()=>program.getUniforms());
                    throwIfBlockingCallExceeded(diag.recentUniformsMs);
                    if(performance.now()-started>=timeoutMs||!canAffordIntrospect()){
                      finished.add(program);skipIntrospect=true;noteDeferredUniforms();
                    }else{
                      diag.lastCompletedPhase='uniforms';
                      timed('attributes','Attributes',()=>program.getAttributes());
                      throwIfBlockingCallExceeded(diag.recentAttributesMs);
                      diag.lastCompletedPhase='attributes';
                      const details=program?.diagnostics;
                      if(details){const note=[details.runnable===false?'not-runnable':'',details.programLog,details.vertexShader?.log,details.fragmentShader?.log].filter(Boolean).join(' | ');if(note&&diag.compilerNote!=='conserved-light-variants'&&diag.compilerNote!=='deferred-uniforms')diag.compilerNote=String(note).slice(0,160);}
                      finished.add(program);
                      if(performance.now()-started>=timeoutMs){skipIntrospect=true;noteDeferredUniforms();}
                    }
                  }finally{const spent=performance.now()-introspectStarted;recordTiming('Introspect',spent);introspectTotalMs+=spent;}
                }
              }
              if(++visited>=8||performance.now()-begin>=4)break;
            }
            report('link',finished.size,programs.size);
            // Rotate unfinished programs so a slow first program does not
            // prevent polling the remaining compiler jobs.
            pending=[...pending.slice(visited),...pending.slice(0,visited)].filter(program=>!finished.has(program));
            if(skipIntrospect&&pending.length){
              for(const program of pending){
                if(timed('link-ready-poll','ReadyPoll',()=>program.isReady()))finished.add(program);
              }
              pending=pending.filter(program=>!finished.has(program));
            }
            stalledPolls=finished.size===previousFinished?stalledPolls+visited:0;
            // Once an entire compiler queue makes no progress, poll at 10ms
            // rather than spinning MessageChannel tasks against the driver.
            if(pending.length&&stalledPolls>=pending.length){stalledPolls=0;await new Promise(resolve=>setTimeout(resolve,10));}
            else await yieldTask();
          }
          jobIndex++;
        }
        if(canceled()){report('canceled',finished.size,programs.size);return false;}
        if(finished.size<programs.size)assertTime();
        preparedPrograms=programs.size;preparedPointLightCounts=[...pointLightCounts].sort((a,b)=>a-b);
        setPhase('ready');diag.lastCompletedPhase='ready';report('ready',programs.size,programs.size);return true;
      }catch(error){
        if(canceled()){report('canceled',finished.size,programs.size);return false;}
        if(!error.code)error.code='PREPARATION_FAILED';
        const frozen=snapshot(error);
        report(error.code==='PREPARATION_TIMEOUT'?'timed-out':'failed',finished.size,programs.size,{preTimeoutSnapshot:frozen});throw error;
      }finally{
        yieldChannel?.port1.close();yieldChannel?.port2.close();resumeYield=null;
        if(preparation===entry)preparation=null;
      }
    }
    // Start in a microtask so even early validation failure cannot leave a stale
    // in-flight entry, and concurrent callers share exactly this promise.
    entry.promise=Promise.resolve().then(run);return entry.promise;
  }
  function render(scene,camera,{time=0,reducedMotion=false,reducedEffects=false,worldOnly=false,exterior=false}={}){
    // Reduced effects skips contact shading while retaining the prepared
    // 4x MSAA target; switching sample counts can cause a first-use GPU hitch.
    reducedEffectsActive=!!reducedEffects;
    const contactEnabled=quality.contact&&!reducedEffectsActive;
    // The world has an eight-metre flight clearance. Giving it its own near
    // plane preserves depth precision; the close gun keeps its original plane.
    const weaponNear=camera.near;camera.near=exterior?weaponNear:Math.max(.5,weaponNear);camera.updateProjectionMatrix();
    resize();renderer.setRenderTarget(hdr);renderer.autoClear=true;camera.layers.set(0);
    renderer.render(scene,camera);
    if(contactEnabled&&(!exterior||worldOnly)){
      // Copy colour only. Exterior aircraft still use the world's untouched
      // multisampled depth; the interior clears it at the original boundary.
      applyContact(camera);
    }
    camera.near=weaponNear;camera.updateProjectionMatrix();
    if(!worldOnly){
      const bg=scene.background;scene.background=null;renderer.autoClear=false;
      // r160 selects lights by camera layers. Separate passes keep aircraft
      // keys off the canyon. Outside, retain depth and identical near planes
      // so the real world still occludes the bomber; inside, preserve the
      // accepted close-weapon precision pass.
      if(!exterior)renderer.clearDepth();
      camera.layers.set(1);renderer.render(scene,camera);camera.layers.set(0);
      scene.background=bg;renderer.autoClear=true;
      if(contactEnabled)applyContact(camera,exterior?1:.045);
    }
    draw(extract,ping);blur.uniforms.tImage.value=ping.texture;blur.uniforms.uDirection.value.set(1/ping.width,0);draw(blur,pong);
    blur.uniforms.tImage.value=pong.texture;blur.uniforms.uDirection.value.set(0,1/ping.height);draw(blur,ping);
    composite.uniforms.uTime.value=time;composite.uniforms.uHeat.value=reducedMotion||!quality.heat?0:.00065;
    // GPU history is lost with the context. Refresh the same texture only
    // after this world's HDR+bloom exists; preserve sting age and gameplay.
    if(stingRecoveryPending){if(snapshotSerial>0)captureStingFrame();stingRecoveryPending=false;}
    draw(composite,null);
  }
  return {render,resize,prepare,quality,contextLost(){
    contextGeneration++;preparedPrograms=0;preparedPointLightCounts=[];preparationStatus={stage:'canceled',completed:0,total:0};
    // Drop GPU ownership while Three's old context tables still own it. Keep
    // target/texture objects so material uniforms and sting identity survive.
    for(const t of [hdr,ping,pong,contact,contactPing,shaded,frozenFrame])t.dispose();
  },recoverContext(){stingRecoveryPending=true;},postMaterial:composite,captureStingFrame,stingSnapshot:()=>({target:frozenFrame,serial:snapshotSerial}),exposure:composite.uniforms.uExposure,stats:()=>({preparedPrograms,preparation:{...preparationStatus},preparedPointLightCounts:[...preparedPointLightCounts],reducedEffects:reducedEffectsActive,worldMsaaSamples:hdr.samples,worldNear:.5,contactOcclusionSamples:quality.contact&&!reducedEffectsActive?8:0,contactScale:.5}),dispose(){for(const t of [hdr,ping,pong,contact,contactPing,shaded,frozenFrame])t.dispose();for(const m of [extract,blur,composite,freezeCopy,occlusion,contactBlur,contactComposite,copy])m.dispose();quad.geometry.dispose();}};
}
