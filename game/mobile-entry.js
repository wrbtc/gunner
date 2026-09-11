// Keep the 3D dependency graph unloaded on unsupported mobile devices.
export function requiresDesktop(nav, media) {
  const ua = nav.userAgent || '';
  if (nav.userAgentData?.mobile === true) return true;
  if (/Android|iPhone|iPad|iPod|Windows Phone|IEMobile|Opera Mini/i.test(ua)) return true;
  // iPadOS can identify itself as macOS when requesting desktop websites.
  if ((nav.platform === 'MacIntel' || /Macintosh/.test(ua)) && nav.maxTouchPoints > 1) return true;
  // A narrow desktop window or touch-capable laptop is not a mobile device.
  const desktopOS = /Windows NT|CrOS|Macintosh|X11/i.test(ua);
  return !desktopOS && nav.maxTouchPoints > 0 && media('(pointer: coarse)').matches && !media('(any-pointer: fine)').matches;
}

export async function enterGame({ nav, media, root, notice, heading, load, source, onError, timeoutMs=60000, setTimer=setTimeout, clearTimer=clearTimeout, events=globalThis.window, now=()=>performance.now() }) {
  if (requiresDesktop(nav, media)) {
    root.dataset.device = 'mobile';
    notice.hidden = false;
    heading.focus({ preventScroll: true });
    return 'mobile';
  }
  root.dataset.device = 'desktop';
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw TypeError('Invalid startup deadline');
  // Treat the outer deadline as a stall watchdog. Long boots may legitimately
  // cross the original wall while assembly and graphics are still progressing.
  let timer,failed=false,rejectTimeout=null,alive=true,lastProgress=now();
  const timeout=()=>Object.assign(Error('Flight startup timed out'),{code:'STARTUP_TIMEOUT'});
  const report=error=>{if(failed)return;failed=true;onError?.(error);};
  const scriptError=event=>report(event.error||event.reason||Error('Flight preparation failed'));
  events?.addEventListener('error',scriptError);events?.addEventListener('unhandledrejection',scriptError);
  const arm=()=>{
    clearTimer(timer);
    const remaining=Math.max(0,timeoutMs-(now()-lastProgress));
    timer=setTimer(()=>rejectTimeout?.(timeout()),remaining);
  };
  const heartbeat=()=>{
    if(!alive||failed)return;
    const current=now();
    if(current-lastProgress>=timeoutMs){rejectTimeout?.(timeout());return;}
    lastProgress=current;arm();
  };
  try{
    const boot=Promise.resolve().then(()=>load(source,{heartbeat}));
    const watchdog=new Promise((_,reject)=>{rejectTimeout=reject;arm();});
    await Promise.race([boot,watchdog]);
    if(now()-lastProgress>=timeoutMs)throw timeout();
    return failed?'failed':'desktop';
  }catch(error){report(error);if(!onError)throw error;return 'failed';}
  finally{
    alive=false;rejectTimeout=null;clearTimer(timer);
    events?.removeEventListener('error',scriptError);events?.removeEventListener('unhandledrejection',scriptError);
  }
}

if (typeof document !== 'undefined') {
  const entry = document.querySelector('script[data-game-entry]');
  let failLoading;
  function showFailure(error){
    if(failLoading){failLoading(error);return;}
    // This remains available if even the lightweight briefing module fails.
    const status=document.getElementById('loadStatus');if(status)status.textContent='Flight preparation could not finish. Please retry.';
    document.getElementById('loadingSystems')?.setAttribute('aria-busy','false');
    const button=document.getElementById('startButton');if(button){const retry=button.cloneNode(true);retry.disabled=false;retry.textContent='RETRY LOADING';retry.addEventListener('click',()=>{retry.disabled=true;location.reload();},{once:true});button.replaceWith(retry);}
  }
  await enterGame({
    nav: navigator,
    media: query => matchMedia(query),
    root: document.documentElement,
    notice: document.getElementById('device-notice'),
    heading: document.getElementById('device-heading'),
    load: async (source,hooks={}) => {
      await import('./src/menu-music.js?v=054-22');
      const briefing=await import('./src/mission-screen.js?v=054-30');
      failLoading=briefing.loadingFailure;
      briefing.bindBootHeartbeat(hooks.heartbeat);
      return import(source);
    },
    source: entry.dataset.gameEntry,
    onError: showFailure,
  });
}
