// Sample-backed Queen cinematic cues from Gina and Bruno's package.
// They share the game's effects volume and never become a loading dependency.
export function installQueenSampleCues(audio,{growl,shriek,growlGain=.82,shriekGain=.62}={}){
  if(!audio||typeof audio.cue!=='function')return Object.freeze({prime(){},pause(){},resume(){},stop(){},syncVolume(){},uninstall(){}});
  const samples={'queen-reveal':growl,'queen-arms-shriek':shriek};
  const gains={'queen-reveal':growlGain,'queen-arms-shriek':shriekGain};
  const cooldown={'queen-reveal':4.5,'queen-arms-shriek':6};
  const last=new Map(),paused=new Set();
  const originalCue=audio.cue.bind(audio);
  let primed=false;
  const masterLevel=()=>audio.muted?0:Number.isFinite(audio.volume)?Math.max(0,Math.min(1,audio.volume)):1;
  function syncVolume(){const level=masterLevel();for(const [kind,media] of Object.entries(samples))if(media)media.volume=Math.max(0,Math.min(1,gains[kind]*level));}
  function play(kind,media){
    if(masterLevel()<=0)return false;
    syncVolume();media.currentTime=0;
    try{void Promise.resolve(media.play()).catch(()=>originalCue(kind));}catch{return originalCue(kind);}
    return true;
  }
  audio.cue=kind=>{
    const media=samples[kind];if(!media)return originalCue(kind);
    const now=performance.now()/1000;
    if(now-(last.get(kind)??-1e9)<cooldown[kind])return false;
    last.set(kind,now);return play(kind,media);
  };
  return Object.freeze({
    prime(){
      if(primed)return;primed=true;
      for(const media of Object.values(samples))if(media)try{
        media.muted=true;media.currentTime=0;
        void Promise.resolve(media.play()).then(()=>{media.pause();media.currentTime=0;media.muted=false;syncVolume();}).catch(()=>{media.muted=false;syncVolume();});
      }catch{media.muted=false;syncVolume();}
    },
    pause(){for(const media of Object.values(samples))if(media&&!media.paused){paused.add(media);media.pause();}},
    resume(){for(const media of paused)try{if(masterLevel()>0)void Promise.resolve(media.play()).catch(()=>{});}catch{}paused.clear();},
    stop(){paused.clear();for(const media of Object.values(samples))if(media){media.pause();media.currentTime=0;}},
    syncVolume,
    uninstall(){audio.cue=originalCue;this.stop();}
  });
}
