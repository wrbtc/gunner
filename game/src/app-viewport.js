(function(){
  var root=document.documentElement;
  function syncAppViewport(){
    var vv=window.visualViewport;
    var height=vv&&vv.height?vv.height:(window.innerHeight||root.clientHeight);
    var offsetTop=vv&&vv.offsetTop?vv.offsetTop:0;
    var layout=window.innerHeight||height;
    var insetBottom=Math.max(0,layout-height-offsetTop);
    var screenH=window.screen&&window.screen.height||0;
    var availH=window.screen&&window.screen.availHeight||screenH;
    var outer=window.outerHeight||0;
    var reserved=screenH-availH;
    if(reserved>=48&&outer>=screenH-16)insetBottom=Math.max(insetBottom,Math.min(72,reserved-24));
    root.style.setProperty('--app-height',Math.round(height)+'px');
    root.style.setProperty('--app-offset-top',Math.round(offsetTop)+'px');
    root.style.setProperty('--app-inset-bottom',Math.round(insetBottom)+'px');
  }
  syncAppViewport();
  window.addEventListener('resize',syncAppViewport);
  if(window.visualViewport){
    visualViewport.addEventListener('resize',syncAppViewport);
    visualViewport.addEventListener('scroll',syncAppViewport);
  }
})();
