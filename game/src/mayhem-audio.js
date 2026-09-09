import {mudImpactBuffer} from './wet-impact.js?v=052';
import {CREATURE_SOUNDS,creatureBuffer} from './creature-audio.js?v=052';
import {tankerBuffer} from './tanker-audio.js?v=052';
import {weaponSoundBuffer,queenSoundBuffer,scoreSoundBuffer} from './audio-palette.js?v=052';
// Original synthesized game sound. No downloaded samples or franchise audio.
// Original industrial/horror palette. Numeric tests do not replace listening acceptance.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const xyz = v => Array.isArray(v) ? v : v ? [v.x || 0, v.y || 0, v.z || 0] : [0, 0, 0];
function random(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

function synthBuffer(ctx, duration, kind, seed = 1) {
  return weaponSoundBuffer(ctx, duration, kind, seed);
}

// Cockpit information has its own acoustic identity and bypasses world deafening.
// All envelopes are finite, cached and driven by actual gameplay transitions.
const CUE_RULES = {
  'cannon-ready': [.30,.15,.35], 'cannon-empty': [.075,.075,.3],
  'gun-overheat': [.8,.20,1], 'gun-cooled': [.32,.15,1],
  'hit-confirm': [.055,.13,.045], 'kill': [.36,.16,.12], 'low-hull': [.64,.20,4],
  'queen-reveal': [3.4,.35,5], 'queen-reload': [1.1,.27,1],
  'queen-attack': [.64,.19,1.1], 'queen-defeated': [3.8,.38,5],
  'victory': [5,.28,8], 'loss': [3,.28,8]
};
export function synthFeedbackProof(ctx, kind='cannon-ready') {
  const rule=CUE_RULES[kind];if(!rule)throw new Error('Unknown feedback cue: '+kind);
  if (kind.startsWith('queen-')) return queenSoundBuffer(ctx, rule[0], kind);
  const duration=rule[0],buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),a=buffer.getChannelData(0),rng=random(0x1639+kind.length*73);
  let low=0,mid=0,phase=0;
  for(let i=0;i<a.length;i++){
    const t=i/ctx.sampleRate,u=t/duration,n=rng()*2-1;low=.987*low+.013*n;mid=.80*mid+.20*n;
    const edge=Math.min(1,t/.008)*Math.min(1,(duration-t)/.035);let v=0;
    if(kind==='hit-confirm'){v=(mid*.8+Math.sin(t*2*Math.PI*1700)*.13)*Math.exp(-t*85);
    }else if(kind==='gun-overheat'){
      phase+=2*Math.PI*(180*Math.exp(-t*3)+55)/ctx.sampleRate;
      v=(mid*.75+n*.10+Math.sin(phase)*.18)*Math.exp(-t*3.5);
    }else if(kind==='gun-cooled'){
      phase+=2*Math.PI*(290+u*260)/ctx.sampleRate;v=(Math.sin(phase)*.23+mid*.2)*Math.sin(Math.PI*u)**2;
    }else if(kind==='cannon-ready'){
      const click=mid*1.8*Math.exp(-t*65),b=Math.max(0,t-.09);
      v=click+(t>.09?(Math.sin(2*Math.PI*420*b)+.45*Math.sin(2*Math.PI*630*b))*Math.exp(-b*21)*.22:0);
    }else if(kind==='cannon-empty')v=(mid*1.4+Math.sin(t*2*Math.PI*180)*.2)*Math.exp(-t*54);
    else if(kind==='low-hull'){
      const beat=t%.32;v=(Math.sin(2*Math.PI*390*beat)+.23*Math.sin(2*Math.PI*585*beat))*.25*Math.sin(Math.PI*Math.min(1,beat/.22))**2*(beat<.22?1:0);
    }else if(kind==='kill'){
      phase+=2*Math.PI*(58+60*Math.exp(-t*13))/ctx.sampleRate;v=(low*3.5+Math.sin(phase)*.38+mid*.25)*Math.exp(-t*10);
    }else if(kind==='loss'){
      phase+=2*Math.PI*(34+58*Math.exp(-t*3))/ctx.sampleRate;v=(low*4+mid*.3+Math.sin(phase)*.4)*Math.exp(-t*1.35);
    }else v=(Math.sin(t*2*Math.PI*147)+.56*Math.sin(t*2*Math.PI*220.5)+.25*Math.sin(t*2*Math.PI*294))*.17*Math.sin(Math.PI*u)**2;
    a[i]=Math.tanh(v)*edge;
  }
  return buffer;
}
function scoreBuffer(ctx, kind) { return scoreSoundBuffer(ctx, kind); }
const SCENE_MIX={approach:[.08,.18,1],canyon:[.18,.035,1],'queen-calm':[.15,.34,.62],'queen-combat':[.29,.018,.78],victory:[0,.34,.5],loss:[.1,0,.28]};

// Two persistent near-field motor voices. Their only motion input is the exact
// normalized speed from the visible barrel assembly: there is no audio envelope
// that can continue independently of the gun. The 14ms AudioParam interpolation
// removes control-rate steps; it does not invent a separate mechanical coast.
const ROTOR_COUNT = 2;
const rotorState = (side = -1) => ({ speed: 0, side, held: false });
const finiteSpeed = value => Number.isFinite(value) ? clamp(value, 0, 1) : 0;
function rotorTargets(state, index = 0) {
  const speed = finiteSpeed(state.speed), variation = index ? 1.012 : 1;
  const frequencyHz = (78 + 730 * speed ** .72) * variation;
  return { speed, frequencyHz, upperHz: frequencyHz * 2.013,
    bodyHz: (37 + 105 * speed) * variation, gritHz: 600 + 2800 * speed,
    gritRate: .25 + 1.6 * speed, pulseHz: 3 + 26 * speed,
    gain: speed > 0 ? .28 * speed ** .55 : 0,
    pan: clamp(Number(state.side) || 0, -1, 1) * .29 };
}
function rotorTexture(ctx) {
  const n = Math.ceil(ctx.sampleRate * 2), buffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buffer.getChannelData(0), rng = random(0x6b5d13); let slow = 0, previous = 0;
  for (let i = 0; i < n; i++) {
    const white = rng() * 2 - 1; slow = slow * .976 + white * .024;
    // Dry uneven tool chatter, subsequently shaped by the speed-linked filter.
    data[i] = (white - previous) * .28 + slow * 1.5; previous = white;
  }
  const fade = Math.min(1024, n >> 2);
  for (let i = 0; i < fade; i++) { const k = i / fade; data[n - fade + i] = data[n - fade + i] * (1 - k) + data[i] * k; }
  return buffer;
}
// One ordered manifest is shared with the preparation worker. Factories retain
// the original sample math, durations and independent random seeds.
export const AUDIO_PREPARATION_RATES=Object.freeze([44100,48000]);
export function audioPreparationJobs(){
  const jobs=[],add=(key,duration,build)=>jobs.push({key,duration,build});
  add('rotor',2,rotorTexture);
  for(const kind of Object.keys(CREATURE_SOUNDS))for(const death of [false,true])add('creature-'+kind+'-'+death,death?CREATURE_SOUNDS[kind]:.14,c=>creatureBuffer(c,kind,death));
  for(const kind of Object.keys(CUE_RULES))add('cue-'+kind,CUE_RULES[kind][0],c=>synthFeedbackProof(c,kind));
  for(const kind of ['tension','release'])add('score-'+kind,8,c=>scoreBuffer(c,kind));
  for(let i=0;i<4;i++)add('gun-'+i,.27,c=>synthBuffer(c,.27,'gun',118+i*170));
  for(const[kind,duration]of [['cannon',.75],['cannonImpact',1.7],['boom',2.4],['metal',.21],['flesh',.21],['rock',.35],['rack',.34],['flyby',.48],['engine',3],['rumble',3]])add(kind,duration,c=>synthBuffer(c,duration,kind,891+duration*100));
  add('mudImpact',.72,mudImpactBuffer);
  for(const[kind,duration]of [['charge',3.1],['spray',1.65],['ignition',.30],['impact',1.3],['step',.28]])add('tanker-'+kind,duration,c=>tankerBuffer(c,kind,duration));
  return jobs;
}
function makeRotorMotor(ctx, destination, texture, index) {
  const output = ctx.createGain(), pan = ctx.createStereoPanner(); output.gain.value = 0;
  output.connect(pan); pan.connect(destination);
  const tone = ctx.createOscillator(), toneGain = ctx.createGain();
  tone.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(9), new Float32Array([0, .82, .24, .15, .07, .035, .025, .013, .008])));
  toneGain.gain.value = .30; tone.connect(toneGain); toneGain.connect(output);
  const upper = ctx.createOscillator(), upperGain = ctx.createGain(); upper.type = 'sine';
  upperGain.gain.value = .055; upper.connect(upperGain); upperGain.connect(output);
  const body = ctx.createOscillator(), bodyGain = ctx.createGain(); body.type = 'triangle';
  bodyGain.gain.value = .26; body.connect(bodyGain); bodyGain.connect(output);
  const grit = ctx.createBufferSource(), gritFilter = ctx.createBiquadFilter(), gritGain = ctx.createGain();
  grit.buffer = texture; grit.loop = true; grit.loopStart = Math.min(1024, texture.length >> 2) / texture.sampleRate;
  gritFilter.type = 'bandpass'; gritFilter.Q.value = .85; gritGain.gain.value = .30;
  grit.connect(gritFilter); gritFilter.connect(gritGain); gritGain.connect(output);
  const pulse = ctx.createOscillator(), pulseDepth = ctx.createGain(); pulse.type = 'sine';
  pulseDepth.gain.value = .025; pulse.connect(pulseDepth); pulseDepth.connect(toneGain.gain);
  const sources = [tone, upper, body, grit, pulse];
  const nodes = [output, pan, tone, toneGain, upper, upperGain, body, bodyGain, grit, gritFilter, gritGain, pulse, pulseDepth];
  const motor = { output, pan, tone, upper, body, grit, gritFilter, pulse, sources, nodes, index, targets: rotorTargets(rotorState(index ? 1 : -1), index) };
  setRotorMotor(motor, rotorState(index ? 1 : -1), ctx.currentTime, true);
  for (const source of sources) source === grit ? source.start(ctx.currentTime, index ? .371 : .019) : source.start();
  return motor;
}
function setRotorMotor(motor, state, time, immediate = false) {
  const t = motor.targets = rotorTargets(state, motor.index);
  const pairs = [[motor.tone.frequency, t.frequencyHz], [motor.upper.frequency, t.upperHz],
    [motor.body.frequency, t.bodyHz], [motor.gritFilter.frequency, t.gritHz],
    [motor.grit.playbackRate, t.gritRate], [motor.pulse.frequency, t.pulseHz],
    [motor.output.gain, t.gain], [motor.pan.pan, t.pan]];
  for (const [param, value] of pairs) {
    if (immediate) { param.cancelScheduledValues(time); param.setValueAtTime(value, time); }
    else param.setTargetAtTime(value, time, .014);
  }
}
function disposeRotorMotor(motor) {
  for (const source of motor.sources) { try { source.stop(); } catch {} }
  for (const node of motor.nodes) { try { node.disconnect(); } catch {} }
}

// Native resume/suspend promises may finish out of request order. Keep one
// transition in flight per context and coalesce queued work to the latest intent.
// The first request still enters the native API synchronously in its user gesture.
function contextTransitions(ctx) {
  let pending = null, inFlight = null, closing = false;
  function pump() {
    if (inFlight || !pending) return;
    const request = pending;
    if (ctx.state === 'closed') {
      pending = null; request.resolve(request.target === 'closed'); return;
    }
    inFlight = request;
    const settle = success => {
      inFlight = null;
      if (pending === request) { pending = null; request.resolve(success); }
      pump();
    };
    try {
      const method = request.target === 'running' ? 'resume' : request.target === 'suspended' ? 'suspend' : 'close';
      Promise.resolve(ctx[method]()).then(() => settle(true), () => settle(false));
    } catch { settle(false); }
  }
  return target => {
    if (closing && target !== 'closed') return Promise.resolve(false);
    if (target === 'closed') closing = true;
    if (pending?.target === target) return pending.promise;
    if (pending) pending.resolve(false);
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    pending = { target, promise, resolve };
    pump();
    return promise;
  };
}

export class SoundEngine {
  constructor({ volume = .65, muted = false } = {}) {
    this._audioPreparation=null;this._audioGeneration=0;this._preparedBanks=null;this._startingBank=null;this._preparationStatus={status:'idle',completed:0,total:104,reason:null,selectedSampleRate:null,retainedPCMBytes:0};
    this.scene='approach';this.musicVolume=.65;this.voiceDuck=1;this.radioOnly=false;this.cueTimes=new Map();this.cueCounts={};this.presentationEnded=false;this.tankerStates=new Map();this.lastTankerStep=-1;this.lastTankerImpact=-1;this.ctx = null; this.master = null; this.volume = clamp(volume, 0, 1); this.muted = !!muted;
    this.voices = new Set(); this.loops = []; this.buffers = {}; this.lastGun = -1; this.lastHit = -1; this.lastFlyby = -1; this.started = false; this.disposed = false; this.seed = 0; this.rotors = [rotorState(-1), rotorState(1)]; this.motors = []; this.motorGraphCreates = 0; this.motorAwaitingUpdate = true; this.listenerPosition = [0, 0, 0]; this.hasListener = false;
  }
  _transitionContext(target) {
    const ctx = this.ctx;
    if (!ctx || this.disposed) return Promise.resolve(false);
    if (this.transitionContext !== ctx) {
      // Retire the old context without allowing its pending resume to restart it.
      void this.requestContextState?.('closed');
      this.transitionContext = ctx; this.requestContextState = contextTransitions(ctx);
    }
    return this.requestContextState(target);
  }
  preparationStats(){return Object.freeze({...this._preparationStatus,sampleRates:AUDIO_PREPARATION_RATES});}
  cancelPreparation(reason='canceled'){
    if(this._audioPreparation)this._audioPreparation.finish('canceled',reason);
    else{this._audioGeneration++;for(const bank of this._preparedBanks?.values()||[])bank.clear();this._preparedBanks?.clear();this._preparedBanks=null;this._startingBank?.clear();this._startingBank=null;this._preparationStatus={...this._preparationStatus,status:'canceled',reason,retainedPCMBytes:0};}
    return this.preparationStats();
  }
  prepareBuffers({timeoutMs=10000,canceled=()=>false,onProgress=()=>{}}={}){
    if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>10000||typeof canceled!=='function'||typeof onProgress!=='function')throw TypeError('Invalid audio preparation options');
    if(this._audioPreparation)return this._audioPreparation.promise;
    if(this.disposed){this.cancelPreparation('disposed');return Promise.resolve(this.preparationStats());}
    if(this.ctx||this._preparationStatus.status!=='idle')return Promise.resolve(this.preparationStats());
    const jobs=audioPreparationJobs(),total=jobs.length*AUDIO_PREPARATION_RATES.length,generation=++this._audioGeneration,started=performance.now();
    const banks=new Map(AUDIO_PREPARATION_RATES.map(rate=>[rate,new Map()]));let worker=null,timer=null,resolve;
    const entry={generation,promise:new Promise(done=>{resolve=done;}),finish:null};this._audioPreparation=entry;
    this._preparationStatus={status:'preparing',completed:0,total,reason:null,selectedSampleRate:null,retainedPCMBytes:0};
    const publish=()=>{try{onProgress(this.preparationStats());}catch{/* Progress observers do not own audio initialization. */}};
    entry.finish=(status,reason=null)=>{
      if(this._audioPreparation!==entry)return;
      clearTimeout(timer);if(worker){worker.onmessage=worker.onerror=worker.onmessageerror=null;try{worker.terminate();}catch{}worker=null;}
      this._audioPreparation=null;this._preparedBanks=status==='ready'?banks:null;
      if(status!=='ready'){for(const bank of banks.values())bank.clear();banks.clear();}this._preparationStatus={...this._preparationStatus,status,reason,retainedPCMBytes:status==='ready'?this._preparationStatus.retainedPCMBytes:0};publish();resolve(this.preparationStats());
    };
    const current=()=>this._audioPreparation===entry&&this._audioGeneration===generation;
    const check=()=>{
      if(!current())return false;
      try{if(this.disposed||canceled()){entry.finish('canceled',this.disposed?'disposed':'startup-canceled');return false;}}catch{entry.finish('canceled','cancellation-check-failed');return false;}
      if(performance.now()-started>=timeoutMs){entry.finish('fallback','timeout');return false;}return true;
    };
    if(!check())return entry.promise;
    if(typeof globalThis.Worker!=='function'){entry.finish('fallback','worker-unavailable');return entry.promise;}
    try{
      worker=new Worker(new URL('./audio-preparation-worker.js?v=054-6',import.meta.url),{type:'module'});
      worker.onmessage=event=>{
        if(!check())return;
        const data=event.data;if(data?.generation!==generation)return;
        const completed=this._preparationStatus.completed;
        if(data.type==='complete'){
          if(completed!==total){entry.finish('fallback','incomplete-bank');return;}
          entry.finish('ready');return;
        }
        const rate=AUDIO_PREPARATION_RATES[Math.floor(completed/jobs.length)],job=jobs[completed%jobs.length],length=job?Math.ceil(rate*job.duration):0;
        if(data.type!=='buffer'||completed>=total||data.sampleRate!==rate||data.key!==job.key||data.channels!==1||data.length!==length||!(data.pcm instanceof Float32Array)||data.pcm.length!==length||data.pcm.byteOffset!==0||data.pcm.buffer.byteLength!==length*4){entry.finish('fallback','invalid-bank');return;}
        // Validate only bounded metadata on the main thread; never scan PCM.
        banks.get(rate).set(job.key,data.pcm);this._preparationStatus.completed++;this._preparationStatus.retainedPCMBytes+=data.pcm.byteLength;publish();
      };
      worker.onerror=event=>{event.preventDefault?.();if(current())entry.finish('fallback','worker-error');};
      worker.onmessageerror=()=>{if(current())entry.finish('fallback','worker-message-error');};
      timer=setTimeout(()=>{if(check())entry.finish('fallback','timeout');},timeoutMs);
      publish();worker.postMessage({type:'prepare',generation});
    }catch{entry.finish('fallback','worker-start-failed');}
    return entry.promise;
  }
  _selectPreparedBank(sampleRate){
    if(this._audioPreparation)this._audioPreparation.finish('fallback','start-before-ready');
    const hadBanks=this._preparedBanks!==null,bank=this._preparedBanks?.get(sampleRate)||null;
    for(const cached of this._preparedBanks?.values()||[])if(cached!==bank)cached.clear();this._preparedBanks?.clear();this._preparedBanks=null;this._startingBank=bank;
    this._preparationStatus.retainedPCMBytes=bank?[...bank.values()].reduce((sum,pcm)=>sum+pcm.byteLength,0):0;
    if(bank)this._preparationStatus={...this._preparationStatus,selectedSampleRate:sampleRate};
    else if(this._preparationStatus.status==='ready')this._preparationStatus={...this._preparationStatus,status:'fallback',reason:hadBanks?'sample-rate-miss':'no-retained-bank',selectedSampleRate:null};
  }
  _preparedBuffer(ctx,key,synthesize){
    const pcm=this._startingBank?.get(key);if(!pcm)return synthesize();
    const buffer=ctx.createBuffer(1,pcm.length,ctx.sampleRate);buffer.getChannelData(0).set(pcm);this._startingBank.delete(key);this._preparationStatus.retainedPCMBytes-=pcm.byteLength;return buffer;
  }
  start() {
    if (this.disposed) return;
    if (this.ctx?.state === 'closed') this._disconnectGraph();
    if (this.ctx) { if(this.radioOnly){this.radioOnly=false;this.effectsBus.gain.value=.9;this.ambienceBus.gain.value=.55;this.feedbackBus.gain.value=.85;this.scoreBus.gain.value=this.musicVolume*this.voiceDuck;} this.started = true; this.motorAwaitingUpdate = true; this.motorBus.gain.cancelScheduledValues(this.ctx.currentTime); this.motorBus.gain.setValueAtTime(0, this.ctx.currentTime); return this._transitionContext('running'); }
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext; if (!Context) {this.cancelPreparation('audio-unavailable');return;}
    try { this.ctx = new Context({ latencyHint: 'interactive' }); } catch {this.cancelPreparation('context-unavailable');return;}
    const c = this.ctx;this._selectPreparedBank(c.sampleRate);
    try{ this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.volume;
    const limiter = c.createDynamicsCompressor(); limiter.threshold.value = -7; limiter.knee.value = 8; limiter.ratio.value = 8; limiter.attack.value = .002; limiter.release.value = .12;
    this.master.connect(limiter); limiter.connect(c.destination); this.limiter = limiter;
    this.perceptionFilter=c.createBiquadFilter();this.perceptionFilter.type='lowpass';this.perceptionFilter.frequency.value=20000;this.perceptionGain=c.createGain();this.perceptionGain.gain.value=1;this.perceptionFilter.connect(this.perceptionGain);this.perceptionGain.connect(this.master);
    this.feedbackBus=c.createGain();this.feedbackBus.gain.value=.85;this.feedbackBus.connect(this.master);
    this.scoreBus=c.createGain();this.scoreBus.gain.value=this.musicVolume;this.scoreBus.connect(this.perceptionFilter);
    this.effectsBus = c.createGain(); this.effectsBus.gain.value = .9; this.effectsBus.connect(this.perceptionFilter);
    this.ambienceBus = c.createGain(); this.ambienceBus.gain.value = .55; this.ambienceBus.connect(this.perceptionFilter);
    // Close mechanical sound stays distinct from the reflected shots. Start the
    // bus silent until a fresh visual rotor update, including every resume.
    this.motorBus = c.createGain(); this.motorBus.gain.value = 0; this.motorBus.connect(this.perceptionFilter);
    const texture = this._preparedBuffer(c,'rotor',()=>rotorTexture(c));
    this.motors = Array.from({length: ROTOR_COUNT}, (_, i) => makeRotorMotor(c, this.motorBus, texture, i));
    this.motorGraphCreates++; this.motorAwaitingUpdate = true;
    // Shared low-level canyon reflections; all source count limits are upstream.
    this.delay = c.createDelay(.8); this.delay.delayTime.value = .137;
    this.delayFilter = c.createBiquadFilter(); this.delayFilter.type = 'lowpass'; this.delayFilter.frequency.value = 1900;
    this.delayGain = c.createGain(); this.delayGain.gain.value = .13;
    this.effectsBus.connect(this.delay); this.delay.connect(this.delayFilter); this.delayFilter.connect(this.delayGain); this.delayGain.connect(this.perceptionFilter);
    for(const kind of Object.keys(CREATURE_SOUNDS))for(const death of [false,true])this.buffers['creature-'+kind+'-'+death]=this._preparedBuffer(c,'creature-'+kind+'-'+death,()=>creatureBuffer(c,kind,death));
    for(const kind of Object.keys(CUE_RULES))this.buffers['cue-'+kind]=this._preparedBuffer(c,'cue-'+kind,()=>synthFeedbackProof(c,kind));
    this.scoreLoops=['tension','release'].map(kind=>this._loop(this._preparedBuffer(c,'score-'+kind,()=>scoreBuffer(c,kind)),0,this.scoreBus));
    this.guns = Array.from({ length: 4 }, (_, i) => this._preparedBuffer(c,'gun-'+i,()=>synthBuffer(c, .27, 'gun', 118 + i * 170)));
    for (const [kind, duration] of [['cannon', .75], ['cannonImpact', 1.7], ['boom', 2.4], ['metal', .21], ['flesh', .21], ['rock', .35], ['rack', .34], ['flyby', .48], ['engine', 3], ['rumble', 3]]) this.buffers[kind] = this._preparedBuffer(c,kind,()=>synthBuffer(c, duration, kind, 891 + duration * 100));
    this.buffers.mudImpact=this._preparedBuffer(c,'mudImpact',()=>mudImpactBuffer(c));
    for(const [kind,duration]of [['charge',3.1],['spray',1.65],['ignition',.30],['impact',1.3],['step',.28]])this.buffers['tanker-'+kind]=this._preparedBuffer(c,'tanker-'+kind,()=>tankerBuffer(c,kind,duration));
    const engine = this._loop(this.buffers.engine, .12), rumble = this._loop(this.buffers.rumble, .105);
    this.engineLoop = engine; this.rumbleLoop = rumble; this.started = true;this.setScene(this.scene);
    const listenerWasExplicit = this.hasListener; this.setListener(this.listenerPosition); this.hasListener = listenerWasExplicit;
    return this._transitionContext('running');
    }finally{this._startingBank?.clear();this._startingBank=null;this._preparationStatus.retainedPCMBytes=0;}
  }
  _loop(buffer, volume, destination = this.ambienceBus) {
    const src = this.ctx.createBufferSource(), gain = this.ctx.createGain(); src.buffer = buffer; src.loop = true;
    // The tail crossfade consumes the first1024samples; repeat after that head.
    src.loopStart = Math.min(1024, Math.floor(buffer.length / 4)) / buffer.sampleRate;
    gain.gain.value = volume; src.connect(gain); gain.connect(destination); src.start(); const item = { src, gain }; this.loops.push(item); return item;
  }
  _play(buffer, volume, { pan = 0, position = null, pitch = 1, priority = 0, delay = 0, offset = 0, feedback = false } = {}) {
    if (!this.ctx || !this.started || this.ctx.state !== 'running' || !buffer) return;
    const limit = priority>=3 ? 36 : priority ? 32 : 28;
    if (this.voices.size >= limit) {
      const victim = Array.from(this.voices).find(v => v.priority < priority);
      if (!victim) return; this._end(victim);
    }
    const c = this.ctx, src = c.createBufferSource(), gain = c.createGain(); src.buffer = buffer; src.playbackRate.value = pitch; gain.gain.value = volume; src.connect(gain);
    let spatial;
    if (position) {
      spatial = c.createPanner(); spatial.panningModel = 'equalpower'; spatial.distanceModel = 'inverse'; spatial.refDistance = 28; spatial.maxDistance = 650; spatial.rolloffFactor = .8;
      const p = xyz(position); spatial.positionX.value = p[0]; spatial.positionY.value = p[1]; spatial.positionZ.value = p[2];
    } else { spatial = c.createStereoPanner(); spatial.pan.value = pan; }
    gain.connect(spatial); spatial.connect(feedback ? this.feedbackBus : this.effectsBus);
    const voice = { src, gain, spatial, priority }; this.voices.add(voice); src.onended = () => this._end(voice, false); src.start(c.currentTime + delay,offset); return voice;
  }
  _end(voice, stop = true) { if (!this.voices.has(voice)) return; this.voices.delete(voice); voice.src.onended = null; if (stop) { try { voice.src.stop(); } catch {} } voice.src.disconnect(); voice.gain.disconnect(); voice.spatial.disconnect(); }
  // Call after the visible assemblies advance. Inputs are copied so mutable
  // preallocated caller state is safe; at most two motors ever exist.
  setRotors(states = []) {
    if (this.disposed) return;
    const input = Array.isArray(states) ? states : [];
    for (let i = 0; i < ROTOR_COUNT; i++) {
      const previous = this.rotors[i], state = input[i] || {};
      const next = { speed: finiteSpeed(state.speed), side: Number.isFinite(state.side) ? clamp(state.side, -1, 1) : (i ? 1 : -1), held: !!state.held };
      this.rotors[i] = next;
      if (this.ctx && this.started && this.ctx.state !== 'closed') {
        setRotorMotor(this.motors[i], next, this.ctx.currentTime);
        if (!this.motorAwaitingUpdate && previous.held !== next.held) this._play(this.buffers.metal, next.held ? .068 : .047, { pan: next.side * .29, pitch: next.held ? 1.8 + i * .045 : 1.45 + i * .035 });
      }
    }
    if (this.ctx && this.started && this.ctx.state !== 'closed' && this.motorAwaitingUpdate) {
      this.motorBus.gain.setTargetAtTime(.9, this.ctx.currentTime, .025);
      this.motorAwaitingUpdate = false;
    }
  }
  gun(side = 0) {
    if (!this.ctx || this.ctx.currentTime - this.lastGun < .018) return;
    this.lastGun = this.ctx.currentTime;
    this._play(this.guns[this.seed++ % 4], .28, { pan: side ? .16 : -.16, pitch: .975 + (this.seed % 5) * .011 });
  }
  tanker(kind,position){
    if(!this.ctx)return;const now=this.ctx.currentTime;
    if(kind==='step'){if(now-this.lastTankerStep<.13)return;this.lastTankerStep=now;}
    if(kind==='impact'){if(now-this.lastTankerImpact<.16)return;this.lastTankerImpact=now;}
    this._play(this.buffers['tanker-'+kind],kind==='step'?.38:kind==='ignition'?.73:.52,{position,priority:kind==='step'?0:1});
  }
  tankerState(id,phase,position,elapsed=0){
    const previous=this.tankerStates.get(id);
    if(previous?.phase!==phase&&previous?.voice)this._end(previous.voice);
    if(phase==='idle'){this.tankerStates.delete(id);return;}
    if(!this.ctx||!this.started||this.ctx.state!=='running')return;
    if(previous?.phase===phase&&this.voices.has(previous.voice)){
      const p=xyz(position);[previous.voice.spatial.positionX,previous.voice.spatial.positionY,previous.voice.spatial.positionZ].forEach((v,i)=>v.setValueAtTime(p[i],this.ctx.currentTime));return;
    }
    const buffer=this.buffers['tanker-'+phase];if(!buffer||elapsed>=buffer.duration-.02)return;
    const voice=this._play(buffer,phase==='spray'?.91:.62,{position,priority:2,offset:Math.max(0,elapsed)});
    this.tankerStates.set(id,{phase,voice});
  }
  confirmHit(){return this.cue('hit-confirm');}
  creature(kind,position,death=false){
    if(!this.ctx||!this.started)return false;
    const voice=this._play(this.buffers['creature-'+kind+'-'+death],death?.54:.20,{position,priority:death?2:1});
    return !!voice;
  }
  hit(kind = 'rock', position = null) {
    if (!this.ctx || this.ctx.currentTime - this.lastHit < .025) return; this.lastHit = this.ctx.currentTime;
    const key = kind === 'demon' || kind === 'flesh' ? 'flesh' : kind === 'iron' || kind === 'metal' ? 'metal' : 'rock';
    this._play(this.buffers[key], .22, { position, pitch: .92 + (this.seed++ % 7) * .025 });
  }
  boom(scale = 1, position = null) { this._play(this.buffers.boom, .7 * clamp(scale, .35, 1.7), { position, priority: 1, pitch: clamp(1.07 - scale * .12, .76, 1.1) }); }
  explosion(scale = 1, position = null) { this.boom(scale, position); }
  damage(surface=null) { if(surface==='mud'){this._play(this.buffers.mudImpact,.70,{priority:2});return;} this._play(this.buffers.metal, .38, { priority: 2, pitch: .55 }); this._play(this.buffers.boom, .22, { priority: 2, pitch: 1.35 }); }
  cannon() { this._play(this.buffers.cannon, .92, {priority:2}); this._play(this.buffers.rack, .16, {priority:1,delay:.12,pitch:.76}); }
  cannonImpact(position) { this._play(this.buffers.cannonImpact, .95, {position,priority:2}); }
  flyby(position = null, heavy = false) {
    if (!this.ctx || this.ctx.currentTime - this.lastFlyby < .16) return; this.lastFlyby = this.ctx.currentTime;
    this._play(this.buffers.flyby, heavy ? .44 : .3, { position, priority: 2, pitch: heavy ? .53 : 1.1 });
  }
  incoming(position, heavy = false) { this.flyby(position, heavy); }
  setListener(position, forward = [0, 0, -1], up = [0, 1, 0]) {
    this.listenerPosition = xyz(position); this.hasListener = true; if (!this.ctx) return;
    const l = this.ctx.listener, p = this.listenerPosition, f = xyz(forward), u = xyz(up), now = this.ctx.currentTime;
    if (l.positionX) {
      [l.positionX, l.positionY, l.positionZ].forEach((param, i) => param.setValueAtTime(p[i], now));
      [l.forwardX, l.forwardY, l.forwardZ].forEach((param, i) => param.setValueAtTime(f[i], now));
      [l.upX, l.upY, l.upZ].forEach((param, i) => param.setValueAtTime(u[i], now));
    } else { l.setPosition(...p); l.setOrientation(...f, ...u); }
    this.hasListener = true;
  }
  update(dt, time = 0, planePosition = null) {
    if (!this.ctx || !this.started) return;
    const now = this.ctx.currentTime, firing = now - this.lastGun < .12;
    const sceneEngine=SCENE_MIX[this.scene]?.[2]??1;
    if (this.engineLoop) { this.engineLoop.src.playbackRate.setTargetAtTime(1 + .025 * Math.sin(time * .23), now, .2); this.engineLoop.gain.gain.setTargetAtTime((firing ? .075 : .12)*sceneEngine, now, .08); }
    this.ambienceBus.gain.setTargetAtTime((firing ? .38 : .55)*(this.sceneAmbienceGain??1), now, .09);
    if (planePosition && !this.hasListener) { this.setListener(planePosition); this.hasListener = false; }
  }
  cue(kind) {
    const rule=CUE_RULES[kind];if(!rule||!this.ctx||!this.started||this.ctx.state!=='running')return false;
    const now=this.ctx.currentTime;if(now-(this.cueTimes.get(kind)??-Infinity)<rule[2])return false;
    const voice=this._play(this.buffers['cue-'+kind],rule[1],{priority:3,feedback:true});
    if(!voice)return false;this.cueTimes.set(kind,now);this.cueCounts[kind]=(this.cueCounts[kind]||0)+1;return true;
  }
  setScene(scene) {
    if(!SCENE_MIX[scene])return false;this.scene=scene;this.presentationEnded=false;
    if(this.ctx&&this.scoreLoops){const mix=SCENE_MIX[scene];for(let i=0;i<2;i++)this.scoreLoops[i].gain.gain.setTargetAtTime(mix[i],this.ctx.currentTime,.7);}
    return true;
  }
  setMusicVolume(value) {this.musicVolume=clamp(Number(value)||0,0,1);if(this.scoreBus)this.scoreBus.gain.setTargetAtTime(this.radioOnly?0:this.musicVolume*this.voiceDuck,this.ctx.currentTime,.035);}
  setVoiceDucking(active) {this.voiceDuck=active?.42:1;if(this.ctx&&this.scoreBus&&!this.radioOnly)this.scoreBus.gain.setTargetAtTime(this.musicVolume*this.voiceDuck,this.ctx.currentTime,.09);}
  resumeRadioOnly() {
    if(this.disposed||!this.ctx||this.ctx.state==='closed')return;
    this.radioOnly=true;this.started=false;this._clearTransientVoices();
    for(const bus of [this.effectsBus,this.ambienceBus,this.motorBus,this.feedbackBus,this.scoreBus]){bus.gain.cancelScheduledValues(this.ctx.currentTime);bus.gain.setValueAtTime(0,this.ctx.currentTime);}
    return this._transitionContext('running');
  }
  startEnding(won) {
    this.reset();const resumed=this.start();this.setScene(won?'victory':'loss');
    // resume() is asynchronous on some browsers. Schedule cue after it resolves;
    // generation guard prevents an old ending from sounding after replay/skip.
    const generation=this.presentationGeneration;
    if(this.ctx){const ctx=this.ctx;void Promise.resolve(resumed).then(ready=>{if(ready&&this.ctx===ctx&&this.presentationGeneration===generation&&this.started&&!this.presentationEnded)this.cue(won?'victory':'loss');}).catch(()=>{});}
  }
  finishPresentation() {this.presentationEnded=true;this.presentationGeneration=(this.presentationGeneration||0)+1;this.pause();}
  setVolume(value) { this.volume = clamp(Number(value) || 0, 0, 1); if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, .025); }
  setMuted(value) { this.muted = !!value; this.setVolume(this.volume); }
  mute(value = true) { this.setMuted(value); }
  _clearTransientVoices() { for (const voice of Array.from(this.voices)) this._end(voice); this.lastGun = this.lastHit = this.lastFlyby = -1; this.seed = 0; this.tankerStates.clear(); this.lastTankerStep=this.lastTankerImpact=-1; }
  reset() {
    // Invalidate queued playback and ending callbacks before replay establishes
    // its new running intent. An in-flight native operation is allowed to settle.
    this.started=false;void this._transitionContext('suspended');
    this.presentationGeneration=(this.presentationGeneration||0)+1;this.cueTimes.clear();this.cueCounts={};this.setScene('approach');
    this._clearTransientVoices(); this.rotors = [rotorState(-1), rotorState(1)];
    this.motorAwaitingUpdate = true;
    if (this.ctx && this.ctx.state !== 'closed') {
      const now = this.ctx.currentTime;
      this.motorBus.gain.cancelScheduledValues(now); this.motorBus.gain.setValueAtTime(0, now);
      for (let i = 0; i < this.motors.length; i++) setRotorMotor(this.motors[i], this.rotors[i], now, true);
    }
  }
  pause() {
    if (!this.ctx) return; this.started = false; this._clearTransientVoices();
    // Suspending freezes the persistent phase and visual state. Resume starts
    // muted until setRotors supplies that next visual state, preventing a burst
    // of stale full-speed audio when the trigger was released by Pause/blur.
    this.motorAwaitingUpdate = true;
    this.motorBus.gain.cancelScheduledValues(this.ctx.currentTime); this.motorBus.gain.setValueAtTime(0, this.ctx.currentTime);
    return this._transitionContext('suspended');
  }
  stop() { this.pause(); }
  stats() {
    // Read-only accounting includes shared buffers once and creates no voices.
    const cached = new Set([...Object.values(this.buffers), ...(this.guns || []),
      ...this.loops.map(loop => loop.src.buffer), ...this.motors.map(motor => motor.grit.buffer)].filter(Boolean));
    let cachedBufferBytes = 0;
    for (const buffer of cached) cachedBufferBytes += buffer.length * buffer.numberOfChannels * 4;
    return { preparation:this.preparationStats(),soundPalette: 'v050-original-physical', cachedBuffers: cached.size, cachedBufferBytes,
      transientSourceCeiling: 36, persistentSourceCount: this.loops.length + this.motors.reduce((n,motor)=>n+motor.sources.length,0),
      activeVoices: this.voices.size, ambientLoops: this.loops.length-(this.scoreLoops?.length||0),totalLoopSources:this.loops.length,
      scene:this.scene,musicVolume:this.musicVolume,cueCounts:{...this.cueCounts},feedbackBypassesSting:true,presentationEnded:this.presentationEnded,scoreLoops:this.scoreLoops?.length||0,
      contextState: this.ctx?.state || (this.disposed ? 'disposed' : 'uninitialized'), muted: this.muted, volume: this.volume,
      rotors: this.rotors.map((state, i) => ({ ...state, ...rotorTargets(state, i) })),
      rotorSpeeds: this.rotors.map(state => state.speed), motorSources: this.motors.reduce((n, motor) => n + motor.sources.length, 0),
      motorNodes: this.motors.reduce((n, motor) => n + motor.nodes.length, 0) + (this.motorBus ? 1 : 0),
      motorGraphCreates: this.motorGraphCreates, motorAwaitingUpdate: this.motorAwaitingUpdate, humanAuditioned: false };
  }
  _disconnectGraph() {
    void this.requestContextState?.('closed');
    this.requestContextState=null;this.transitionContext=null;
    this._clearTransientVoices();
    for (const motor of this.motors) disposeRotorMotor(motor); this.motors = [];
    for (const item of this.loops) { try { item.src.stop(); } catch {} item.src.disconnect(); item.gain.disconnect(); }
    this.loops = [];this.scoreLoops=null;
    for (const key of ['feedbackBus','scoreBus','perceptionGain','perceptionFilter','motorBus', 'effectsBus', 'ambienceBus', 'delay', 'delayFilter', 'delayGain', 'master', 'limiter']) {
      try { this[key]?.disconnect(); } catch {} this[key] = null;
    }
    this.ctx = null; this.started = false; this.engineLoop = null; this.rumbleLoop = null; this.buffers = {}; this.guns = [];
  }
  dispose() {
    if (this.disposed) return;
    this.cancelPreparation('disposed');
    // Capture even a context that has not yet received a transition request.
    if(this.ctx&&this.transitionContext!==this.ctx)this._transitionContext('suspended');
    this.disposed = true; this.reset(); this._disconnectGraph();
  }
}

export const createMayhemAudio = options => new SoundEngine(options);

// Diagnostic only: render the same original sample families through the same
// output compressor offline. This proves numeric output, not perceived quality.
export async function renderMayhemAudioProof(duration = 88, sampleRate = 22050) {
  const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Offline) throw new Error('OfflineAudioContext unavailable');
  const c = new Offline(2, Math.ceil(duration * sampleRate), sampleRate);
  const master = c.createGain(); master.gain.value = .65;
  const limiter = c.createDynamicsCompressor(); limiter.threshold.value = -7; limiter.knee.value = 8; limiter.ratio.value = 8; limiter.attack.value = .002; limiter.release.value = .12; master.connect(limiter); limiter.connect(c.destination);
  const delay = c.createDelay(.8), feedback = c.createGain(), filter = c.createBiquadFilter(); delay.delayTime.value = .137; feedback.gain.value = .13; filter.type = 'lowpass'; filter.frequency.value = 1900; delay.connect(filter); filter.connect(feedback); feedback.connect(master);
  const gun = Array.from({ length: 4 }, (_, i) => synthBuffer(c, .27, 'gun', 118 + i * 170));
  const boom = synthBuffer(c, 2.4, 'boom', 1131), hit = synthBuffer(c, .35, 'rock', 926), rack = synthBuffer(c, .34, 'rack', 925);
  const events = []; let shot = 0;
  function play(buffer, when, gainValue, pan = 0, loop = false) {
    const s = c.createBufferSource(), g = c.createGain(), p = c.createStereoPanner(); s.buffer = buffer; s.loop = loop; if (loop) s.loopStart = Math.min(1024, Math.floor(buffer.length / 4)) / buffer.sampleRate; g.gain.value = gainValue; p.pan.value = pan; s.connect(g); g.connect(p); p.connect(master); if (!loop) p.connect(delay); s.start(when); if (loop) s.stop(duration); events.push([when, loop ? duration : Math.min(duration, when + buffer.duration)]);
  }
  play(synthBuffer(c, 3, 'engine', 1191), 0, .12 * .55, 0, true); play(synthBuffer(c, 3, 'rumble', 1191), 0, .105 * .55, 0, true);
  for (let t = .5; t < duration - .3; t += 1 / 18) if (t % 12 < 8.5) { play(gun[shot % 4], t, .32 * .9, shot % 2 ? .16 : -.16); if (shot % 4 === 0) play(hit, t + .07, .22 * .9, Math.sin(t)); shot++; }
  for (let t = 3.2; t < duration - 2.5; t += 9) { play(rack, t - .4, .46 * .9, .2); play(boom, t, .9, -.3); }
  const buffer = await c.startRendering(); let peak = 0, sum = 0, invalid = 0, clipped = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) for (const v of buffer.getChannelData(ch)) { if (!Number.isFinite(v)) invalid++; peak = Math.max(peak, Math.abs(v)); sum += v * v; if (Math.abs(v) >= 1) clipped++; }
  const boundaries = events.flatMap(([a, b]) => [[a, 1], [b, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); let count = 0, maxVoices = 0; for (const [, delta] of boundaries) { count += delta; maxVoices = Math.max(maxVoices, count); }
  return { buffer, metrics: { duration, sampleRate, channels: 2, scheduledSources: events.length, maxOverlappingSources: maxVoices, peak, rms: Math.sqrt(sum / (buffer.length * 2)), nonFiniteSamples: invalid, clippedSamples: clipped, humanAuditioned: false, classification: 'Offline legacy gun/hit/bomb/ambience sample mix without rotary motors; use renderRotaryAudioProof for the v0.6 rotor graph; not human audition or real-time playback proof' } };
}

// Diagnostic: the caller supplies recorded or geometry-generated rotor states.
// This renders the SAME persistent motor graph; it never invents a second spin
// model. Numeric output and pitch targets do not substitute for human listening.
export async function renderRotaryAudioProof(rotorFrames, { duration = 8, sampleRate = 44100, includeGunfire = false, includeAmbience = false, shotEvents = null } = {}) {
  const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Offline) throw new Error('OfflineAudioContext unavailable');
  if (!Number.isFinite(duration) || duration <= 0 || duration > 120) throw new Error('Expected a bounded duration in (0,120] seconds');
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 96000) throw new Error('Expected sample rate from 8000 through 96000');
  if (!Array.isArray(rotorFrames) || !rotorFrames.length) throw new Error('Recorded visual rotor frames are required');
  let previousTime = -1;
  const frames = rotorFrames.map(frame => {
    if (!Number.isFinite(frame.time) || frame.time < 0 || frame.time < previousTime || frame.time >= duration) throw new Error('Rotor frame times must be sorted and inside the render');
    if (!Array.isArray(frame.rotors) || frame.rotors.length !== ROTOR_COUNT) throw new Error('Exactly two visual rotor states are required per frame');
    previousTime = frame.time;
    return { time: frame.time, rotors: frame.rotors.map((state, i) => {
      if (!Number.isFinite(state.speed) || state.speed < 0 || state.speed > 1) throw new Error('Rotor speed must be finite and normalized');
      return { speed: state.speed, side: Number.isFinite(state.side) ? clamp(state.side, -1, 1) : (i ? 1 : -1), held: !!state.held };
    }) };
  });
  const ctx = new Offline(2, Math.ceil(duration * sampleRate), sampleRate);
  const master = ctx.createGain(); master.gain.value = .65;
  const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -7; limiter.knee.value = 8; limiter.ratio.value = 8; limiter.attack.value = .002; limiter.release.value = .12;
  master.connect(limiter); limiter.connect(ctx.destination);
  const motorBus = ctx.createGain(); motorBus.gain.value = .9; motorBus.connect(master);
  const texture = rotorTexture(ctx), motors = Array.from({length: ROTOR_COUNT}, (_, i) => makeRotorMotor(ctx, motorBus, texture, i));
  const effects = ctx.createGain(); effects.gain.value = .9; effects.connect(master);
  const delay = ctx.createDelay(.8), delayFilter = ctx.createBiquadFilter(), delayGain = ctx.createGain();
  delay.delayTime.value = .137; delayFilter.type = 'lowpass'; delayFilter.frequency.value = 1900; delayGain.gain.value = .13;
  effects.connect(delay); delay.connect(delayFilter); delayFilter.connect(delayGain); delayGain.connect(master);
  const useGunfire = includeGunfire || shotEvents !== null;
  if (shotEvents !== null && (!Array.isArray(shotEvents) || shotEvents.some(event => !Number.isFinite(event.time) || event.time < 0 || event.time >= duration || ![0, 1].includes(event.side)))) throw new Error('Shot events need bounded times and gun side indices 0 or 1');
  const events = [], metal = synthBuffer(ctx, .21, 'metal', 912);
  const guns = useGunfire ? Array.from({length: 4}, (_, i) => synthBuffer(ctx, .27, 'gun', 118 + i * 170)) : [];
  function play(buffer, time, level, pan = 0, pitch = 1, loop = false) {
    const source = ctx.createBufferSource(), gain = ctx.createGain(), panner = ctx.createStereoPanner();
    source.buffer = buffer; source.playbackRate.value = pitch; source.loop = loop;
    if (loop) source.loopStart = Math.min(1024, buffer.length >> 2) / buffer.sampleRate;
    gain.gain.value = level; panner.pan.value = pan;
    source.connect(gain); gain.connect(panner); panner.connect(loop ? master : effects);
    source.start(time); if (loop) source.stop(duration);
    events.push([time, loop ? duration : Math.min(duration, time + buffer.duration / pitch)]);
  }
  const held = [false, false]; let shotTime = 0, shots = 0, switches = 0;
  frames.forEach((frame, index) => {
    frame.rotors.forEach((state, i) => {
      setRotorMotor(motors[i], state, frame.time);
      if (held[i] !== state.held) {
        play(metal, frame.time, state.held ? .068 : .047, state.side * .29, state.held ? 1.8 + i * .045 : 1.45 + i * .035);
        switches++; held[i] = state.held;
      }
    });
    if (useGunfire && shotEvents === null) {
      const until = frames[index + 1]?.time ?? duration;
      if (shotTime < frame.time) shotTime = frame.time;
      if (frame.rotors.some(state => state.held)) {
        while (shotTime < until) {
          play(guns[shots % 4], shotTime, .32, shots % 2 ? .16 : -.16, .975 + ((shots + 1) % 5) * .011);
          shots++; shotTime += 1 / 18;
        }
      } else shotTime = until;
    }
  });
  if (shotEvents) for (const event of shotEvents) {
    play(guns[shots % 4], event.time, .32, event.side ? .16 : -.16, .975 + ((shots + 1) % 5) * .011); shots++;
  }
  if (includeAmbience) {
    play(synthBuffer(ctx, 3, 'engine', 1191), 0, .12 * .55, 0, 1, true);
    play(synthBuffer(ctx, 3, 'rumble', 1191), 0, .105 * .55, 0, 1, true);
  }
  for (const motor of motors) for (const source of motor.sources) source.stop(duration);
  const buffer = await ctx.startRendering(); let peak = 0, sum = 0, invalid = 0, clipped = 0;
  const windowSamples = Math.max(1, Math.round(sampleRate / 4)), windows = [];
  for (let start = 0; start < buffer.length; start += windowSamples) {
    let squareSum = 0, windowPeak = 0, samples = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = start; i < Math.min(buffer.length, start + windowSamples); i++) {
        const v = data[i]; if (!Number.isFinite(v)) invalid++;
        peak = Math.max(peak, Math.abs(v)); windowPeak = Math.max(windowPeak, Math.abs(v));
        sum += v * v; squareSum += v * v; samples++; if (Math.abs(v) >= 1) clipped++;
      }
    }
    windows.push({ time: start / sampleRate, rms: Math.sqrt(squareSum / samples), peak: windowPeak });
  }
  const boundaries = events.flatMap(([a, b]) => [[a, 1], [b, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let count = 0, maxTransientSources = 0; for (const [, delta] of boundaries) { count += delta; maxTransientSources = Math.max(maxTransientSources, count); }
  return { buffer, metrics: { duration, sampleRate, channels: 2, inputRotorFrames: frames.length,
    persistentMotorSources: ROTOR_COUNT * 5, motorNodes: ROTOR_COUNT * 13 + 1, scheduledTransientSources: events.length,
    maxOverlappingSources: maxTransientSources + ROTOR_COUNT * 5, shots, switchAccents: switches,
    peak, rms: Math.sqrt(sum / (buffer.length * 2)), nonFiniteSamples: invalid, clippedSamples: clipped,
    windows, includeGunfire: useGunfire, explicitShotEvents: shotEvents !== null, includeAmbience, humanAuditioned: false,
    classification: 'Offline original rotary motor using supplied visual rotor states and the live synthesis graph; numeric output, not human audition or real-time playback proof' } };
}

export function synthCannonProof(ctx,kind='cannon'){return synthBuffer(ctx,kind==='cannon'?.75:1.7,kind,891+(kind==='cannon'?.75:1.7)*100);}
