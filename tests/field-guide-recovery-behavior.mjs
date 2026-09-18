import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../game/vendor/three.module.js?v=052';

// Execute the complete viewer with a deterministic DOM/WebGL adapter. These
// checks exercise asynchronous UI state, not browser or GPU rendering coverage.
const source=readFileSync(new URL('../game/src/field-guide-viewer.js',import.meta.url),'utf8')
 .replace(/^import .*\n/,'').replaceAll('export ','');
class Element {
 constructor(){this.listeners=new Map();this.queries=new Map();this.children=[];this.dataset={};this.style={};this.attributes={};this.open=false;this.hidden=false;this.clientHeight=600;this.textContent='';}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item!==fn));}
 async emit(type,event={}){await Promise.all((this.listeners.get(type)||[]).map(fn=>fn(event)));}
 setAttribute(name,value){this.attributes[name]=value;}
 removeAttribute(name){delete this.attributes[name];}
 querySelector(selector){if(!this.queries.has(selector))this.queries.set(selector,new Element());return this.queries.get(selector);}
 querySelectorAll(){return [];}
 closest(selector){return selector==='[data-creature]'?this.card:null;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 getBoundingClientRect(){return {width:800,height:600,left:0,right:800,top:0,bottom:600};}
 showModal(){this.open=true;}
 close(){this.open=false;void this.emit('close');}
 focus(){} remove(){} setPointerCapture(){}
 get currentSrc(){return this.src||'';}
}
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const model=id=>({root:Object.assign(new THREE.Group(),{name:'Guide '+id}),viewBounds:new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1)),disposals:0,dispose(){this.disposals++;}});
const turn=()=>new Promise(resolve=>setTimeout(resolve,15));
function fixture(make,modelIds){
 const document=new Element();document.body=new Element();document.createElement=()=>new Element();document.hidden=false;
 const frames=new Map(),renderers=[];let nextFrame=0;
 class Renderer {
  constructor(){this.domElement=new Element();this.domElement.toDataURL=()=>{if(this.failThumbnail)throw Error('thumbnail failed');return 'data:image/png;base64,preview';};this.rendered=[];renderers.push(this);}
  setPixelRatio(){} setSize(width,height){this.size=[width,height];} setClearColor(){} dispose(){} forceContextLoss(){}
  render(scene){this.lastScene=scene;if(this.failRender)throw Error('render failed');this.rendered.push(scene.children.filter(n=>n.name.startsWith('Guide ')).map(n=>n.name));}
 }
 const context={THREE:{...THREE,WebGLRenderer:Renderer},document,setTimeout,queueMicrotask,
  matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),
  ResizeObserver:class{observe(){} disconnect(){}},
  requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id)};
 vm.createContext(context);vm.runInContext(source,context);
 const dialog=new Element();dialog.open=true;
 const viewer=context.createFieldGuideViewer({dialog,provider:()=>make,modelIds});
 const detail=document.body.children[0],stage=detail.querySelector('.guide-model-stage');
 const button=id=>{const result=new Element(),card=new Element();card.dataset.creature=id;card.querySelector('h3').textContent=id;result.card=card;return result;};
 return {viewer,dialog,detail,stage,button,renderers,frame(now=100){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));}};
}

// One optional model failure must not prevent every later model from loading;
// retry only the missing entry on the next explicit preparation request.
{
 const calls=[],models=new Map();let failEgg=true;
 const f=fixture(async id=>{calls.push(id);if(id==='eggs'&&failEgg)throw Error('egg missing');const value=model(id);models.set(id,value);return value;},['eggs','creepers','dragons']);
 await f.viewer.prepare();
 assert.deepEqual(calls,['eggs','creepers','dragons']);
 assert.deepEqual(Array.from(f.viewer.stats().models),['creepers','dragons']);
 f.viewer.show(f.button('creepers'));
 assert.equal(f.viewer.stats().current,'Guide creepers');
 assert.equal(f.detail.querySelector('[role=status]').textContent,'');
 failEgg=false;await f.viewer.prepare();assert.deepEqual(calls,['eggs','creepers','dragons','eggs']);
 assert.equal(f.viewer.stats().error,null);
 f.viewer.dispose();assert.ok([...models.values()].every(value=>value.disposals===1));
}

// A ready or newly completed selection remains interactive while a different
// asset is pending, and background thumbnails never replace its canvas image.
{
 const dragon=deferred(),creeper=model('creepers');let ticks=0;
 creeper.tick=()=>{ticks++;};
 const f=fixture(async id=>id==='dragons'?dragon.promise:creeper,['creepers','dragons']);
 f.viewer.show(f.button('creepers'));
 const preparing=f.viewer.prepare();await turn();
 assert.equal(f.viewer.stats().building,true);
 assert.equal(f.viewer.stats().current,'Guide creepers');
 assert.equal(f.detail.querySelector('.guide-model-tools').hidden,false);
 f.frame();assert.equal(ticks,1);
 const canvas=f.renderers[0].domElement;
 await canvas.emit('pointerdown',{clientX:0,clientY:0,pointerId:1});
 await canvas.emit('pointermove',{clientX:20,clientY:0});
 const yaw=f.viewer.stats().rotation[1];assert.ok(yaw>0);
 dragon.resolve(model('dragons'));await preparing;
 assert.equal(f.viewer.stats().current,'Guide creepers');
 assert.equal(f.viewer.stats().rotation[1],yaw);
 assert.deepEqual(f.renderers[0].rendered.at(-1),['Guide creepers']);
 assert.deepEqual(f.renderers[0].size,[800,600]);
 f.viewer.dispose();
}

// A thumbnail failure disposes the newly created model, continues the roster,
// and does not leave a failed mesh attached to the shared scene.
for(const failure of ['failThumbnail','failRender']){
 const broken=model('eggs');let f;
 f=fixture(async id=>{f.renderers[0][failure]=id==='eggs';return id==='eggs'?broken:model(id);},['eggs','creepers']);
 await f.viewer.prepare();assert.equal(broken.disposals,1);
 assert.deepEqual(Array.from(f.viewer.stats().models),['creepers']);
 assert.ok(!f.renderers[0].lastScene.children.includes(broken.root));
 f.viewer.dispose();assert.equal(broken.disposals,1);
}

// Late providers cannot repopulate a closed viewer or retain their resources.
{
 const pending=deferred(),late=model('creepers');const f=fixture(()=>pending.promise,['creepers']);
 const preparing=f.viewer.prepare();f.dialog.close();pending.resolve(late);await preparing;
 assert.equal(late.disposals,1);assert.equal(f.viewer.stats().models.length,0);assert.equal(f.viewer.stats().contexts,0);
 f.viewer.dispose();assert.equal(late.disposals,1);
}

// Finishing roster preparation must not reset an in-flight specimen selection.
{
 const dragon=deferred(),larva=deferred();
 const f=fixture(async id=>id==='dragons'?dragon.promise:id==='egg-maggot'?larva.promise:model(id),['eggs','dragons']);
 f.viewer.show(f.button('eggs'));const preparing=f.viewer.prepare();await turn();
 const specimen=f.detail.querySelector('[data-specimen]');specimen.value='egg-maggot';const choosing=specimen.emit('change');
 dragon.resolve(model('dragons'));await preparing;
 assert.equal(f.viewer.stats().current,null);assert.equal(f.detail.querySelector('[role=status]').textContent,'Loading specimen…');
 larva.resolve(model('egg-maggot'));await choosing;
 assert.equal(f.viewer.stats().current,'Guide egg-maggot');
 f.viewer.dispose();
}

// Queen has an authored still rather than a museum model. Its enlarge button
// must show that still without exposing superseded stills on museum cards.
{
 const f=fixture(async id=>model(id),[]),queen=f.button('queen');
 queen.card.querySelector('img').src='./assets/field-guide/queen.png?v=054-74';
 Object.defineProperty(queen.card.querySelector('img'),'currentSrc',{value:''});
 f.viewer.show(queen);assert.equal(f.stage.children.length,1);
 assert.equal(f.stage.children[0].src,queen.card.querySelector('img').src);
 const creeper=f.button('creepers');creeper.card.querySelector('img').src='./old-creeper.png';
 f.viewer.show(creeper);assert.equal(f.stage.children.length,0);
 f.viewer.dispose();
}
console.log('PASS: Field Guide per-model recovery, immediate ready selections, shared canvas restoration, failed/late resource disposal, specimen selection races, and Queen enlargement');
