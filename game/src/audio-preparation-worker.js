import {AUDIO_PREPARATION_RATES,audioPreparationJobs} from './mayhem-audio.js?v=054-6';
// Pure PCM only. The owner terminates this one worker on deadline/cancellation;
// no AudioContext/AudioBuffer/AudioNode or playback is created here.
let started=false;
self.onmessage=event=>{
 const request=event.data;if(started||request?.type!=='prepare'||!Number.isInteger(request.generation)||request.generation<1)throw Error('Invalid audio preparation request');
 started=true;const jobs=audioPreparationJobs();
 for(const sampleRate of AUDIO_PREPARATION_RATES){
  const context={sampleRate,createBuffer(channels,length,rate){
   if(channels!==1||rate!==sampleRate||!Number.isInteger(length)||length<1||length>sampleRate*8)throw Error('Invalid synthesized audio buffer');
   const pcm=new Float32Array(length);return{sampleRate,length,numberOfChannels:1,duration:length/sampleRate,getChannelData(channel){if(channel!==0)throw Error('Invalid audio channel');return pcm;}};
  }};
  for(const job of jobs){
   const buffer=job.build(context),pcm=buffer.getChannelData(0);
   self.postMessage({type:'buffer',generation:request.generation,sampleRate,key:job.key,channels:1,length:buffer.length,pcm},[pcm.buffer]);
  }
 }
 self.postMessage({type:'complete',generation:request.generation});
};
