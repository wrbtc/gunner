(function(){
  var root=document.documentElement;
  var DOCK_INSET_CAP=96;
  var DOCK_CLEARANCE=8;
  function dockOverlap(){
    var availBottom=(typeof screen==='undefined')?0:((screen.availTop||0)+(screen.availHeight||0));
    var windowBottom=(window.screenY||0)+(window.outerHeight||0);
    if(!(availBottom>0&&windowBottom>0))return 0;
    return Math.max(0,windowBottom-availBottom);
  }
  function syncAppViewport(){
    var vv=window.visualViewport;
    var visual=vv&&vv.height?vv.height:0;
    var layout=window.innerHeight||root.clientHeight||0;
    var height=visual||layout;
    // Size to the visible box so the poster cannot extend under Safari chrome or the Dock.
    if(visual&&layout)height=Math.min(visual,layout);
    var offsetTop=vv&&vv.offsetTop?vv.offsetTop:0;
    var slack=0;
    // Leftover layout-vs-visual chrome, capped at 24px. Intel maximized Safari
    // can keep layout≈visual while the window still paints into the Dock, so
    // this slack is no longer the only inset source.
    if(layout>height+offsetTop)slack=Math.min(24,layout-height-offsetTop);
    var overlap=Math.min(DOCK_INSET_CAP,dockOverlap());
    var dockInset=overlap>0?Math.min(DOCK_INSET_CAP,overlap+DOCK_CLEARANCE):0;
    var insetBottom=Math.max(slack,dockInset);
    root.style.setProperty('--app-height',Math.round(height)+'px');
    root.style.setProperty('--app-offset-top',Math.round(offsetTop)+'px');
    root.style.setProperty('--app-inset-bottom',Math.round(insetBottom)+'px');
    // Short box (≤864) collapses Coming Soon extras and applies the Dock pad.
    // End-pack stays on every height.
    if(height<=864)root.setAttribute('data-app-short','');
    else root.removeAttribute('data-app-short');
  }
  syncAppViewport();
  window.addEventListener('resize',syncAppViewport);
  window.addEventListener('pageshow',syncAppViewport);
  if(window.visualViewport){
    visualViewport.addEventListener('resize',syncAppViewport);
    visualViewport.addEventListener('scroll',syncAppViewport);
  }
})();
