(function(){
  var root=document.documentElement;
  function syncAppViewport(){
    var vv=window.visualViewport;
    var visual=vv&&vv.height?vv.height:0;
    var layout=window.innerHeight||root.clientHeight||0;
    var height=visual||layout;
    // Size to the visible box so the poster cannot extend under Safari chrome or the Dock.
    if(visual&&layout)height=Math.min(visual,layout);
    var offsetTop=vv&&vv.offsetTop?vv.offsetTop:0;
    var insetBottom=0;
    if(layout>height+offsetTop)insetBottom=Math.min(24,layout-height-offsetTop);
    root.style.setProperty('--app-height',Math.round(height)+'px');
    root.style.setProperty('--app-offset-top',Math.round(offsetTop)+'px');
    root.style.setProperty('--app-inset-bottom',Math.round(insetBottom)+'px');
    // CSS max-height media queries can see a taller layout box than the Dock-safe view.
    if(height<=920)root.setAttribute('data-app-short','');
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
