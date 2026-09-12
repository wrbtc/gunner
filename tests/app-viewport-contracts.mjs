import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../game/src/app-viewport.js',import.meta.url),'utf8');

assert.match(source,/availTop/);
assert.match(source,/availHeight/);
assert.match(source,/screenY/);
assert.match(source,/outerHeight/);
assert.match(source,/DOCK_INSET_CAP=96/);
assert.match(source,/DOCK_CLEARANCE=8/);
assert.match(source,/Math\.min\(24,layout-height-offsetTop\)/);
assert.doesNotMatch(source,/height<=920/);

function measure(opts={}){
  const{
    visual=802,
    layout=802,
    offsetTop=0,
    availTop=23,
    availHeight=792,
    screenY=23,
    outerHeight=803,
    clientHeight=802
  }=opts;
  const props={};
  const attributes={};
  const root={
    clientHeight,
    style:{setProperty(name,value){props[name]=value;}},
    setAttribute(name,value){attributes[name]=value;},
    removeAttribute(name){delete attributes[name];}
  };
  const visualViewport={
    height:visual,
    offsetTop,
    addEventListener(){}
  };
  const context={
    document:{documentElement:root},
    window:{
      visualViewport,
      innerHeight:layout,
      screenY,
      outerHeight,
      addEventListener(){}
    },
    screen:{availTop,availHeight},
    visualViewport
  };
  vm.runInNewContext(source,context);
  return{
    inset:Number.parseInt(props['--app-inset-bottom'],10),
    height:Number.parseInt(props['--app-height'],10),
    short:Object.prototype.hasOwnProperty.call(attributes,'data-app-short'),
    props
  };
}

// GATE-class Intel maximized Safari: layout≈visual so slack is 0, but the
// window still paints past avail-bottom (~815). Overlap 11 + 8 clearance = 19.
const gate=measure({visual:802,layout:802,availTop:23,availHeight:792,screenY:23,outerHeight:803});
assert.equal(gate.height,802);
assert.equal(gate.short,true);
assert.equal(gate.inset,19);
assert.ok(gate.inset>=8,'short Dock steal must set a non-zero inset with ≥8px clearance');

const noDock=measure({visual:900,layout:900,availTop:23,availHeight:977,screenY:23,outerHeight:977});
assert.equal(noDock.short,false);
assert.equal(noDock.inset,0);

const slackOnly=measure({visual:800,layout:820,offsetTop:0,availTop:23,availHeight:977,screenY:23,outerHeight:900});
assert.equal(slackOnly.inset,20);

const capped=measure({visual:802,layout:802,availTop:23,availHeight:700,screenY:23,outerHeight:900});
assert.equal(capped.inset,96);

console.log('PASS app-viewport-contracts');
