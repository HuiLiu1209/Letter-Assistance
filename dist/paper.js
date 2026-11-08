import * as THREE from 'three';
import {PrintLayout} from './print-layout.js';
import {ringPrinterBell} from './bell.js';
import {createTypewriterMechanics,paperPath,ROLLER} from './mechanics.js';
const gsap=window.gsap;
const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAGE_W=4.4,PAGE_H=6.22,TEX_W=1024,TEX_H=1448,TOP=118,LINE=37,INK_HEIGHT=32;
const feedForRow=row=>(TOP+row*LINE+INK_HEIGHT)/TEX_H*PAGE_H;
export function createPaperPrinter({scene,model,camera,controls,restoreView}) {
  const mechanics=createTypewriterMechanics(model),restBounds=new THREE.Box3().setFromObject(model);
  const host=document.getElementById('scene'),canvas=document.createElement('canvas');canvas.width=TEX_W;canvas.height=TEX_H;
  const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
  const material=new THREE.MeshStandardMaterial({map:texture,color:0xffffff,roughness:.95,metalness:0,side:THREE.DoubleSide,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.55});
  const geometry=new THREE.BufferGeometry(),rings=128,across=4,count=(rings+1)*(across+1),indices=[];
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(count*2),2));
  for(let i=0;i<rings;i++)for(let j=0;j<across;j++){const a=i*(across+1)+j,b=a+1,c=a+across+1,d=c+1;indices.push(a,b,c,b,d,c);}geometry.setIndex(indices);
  const paper=new THREE.Mesh(geometry,material);paper.visible=false;paper.castShadow=true;paper.receiveShadow=true;scene.add(paper);
  const motion={x:0},cell=28*.6;
  const carriageX=pixel=>PAGE_W/2-pixel/TEX_W*PAGE_W;
  const leftStart=carriageX(100+cell/2);
  function applyCarriage(){mechanics.setCarriage(motion.x);paper.position.x=motion.x;host.dataset.carriageX=motion.x.toFixed(3);}
  const travel={feed:0};let active=null,cameraSnapshot,framedTop=0;
  function blank(){ctx.fillStyle='#f0e7d4';ctx.fillRect(0,0,TEX_W,TEX_H);ctx.fillStyle='#1e1a16';ctx.font='600 28px "Courier New", monospace';ctx.textBaseline='top';texture.needsUpdate=true;}
  // s=0 is the fixed printing point. The unprinted lower sheet curves behind the roller;
  // only the already-fed top emerges. UVs follow the same full-size sheet without scaling.
  function layoutPaper(){
    const top=travel.feed,bottom=Math.max(top-PAGE_H,-Math.PI*ROLLER.radius*.86),p=geometry.attributes.position,uv=geometry.attributes.uv;
    for(let i=0;i<=rings;i++){
      const s=bottom+(top-bottom)*i/rings;
      const {y,z}=paperPath(s);
      for(let j=0;j<=across;j++){const u=j/across,k=i*(across+1)+j;p.setXYZ(k,(u-.5)*PAGE_W,y,z);uv.setXY(k,u,1-(top-s)/PAGE_H);}
    }
    p.needsUpdate=uv.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    mechanics.setRoller(travel.feed);
    host.dataset.paperFeed=travel.feed.toFixed(3);host.dataset.paperTopZ=paperPath(top).z.toFixed(3);host.dataset.paperScale='1';
  }
  function framePaper(animate=true){
    const bounds=restBounds.clone();bounds.min.x-=1.8;bounds.max.x+=1.8;bounds.union(new THREE.Box3().setFromObject(paper));const target=bounds.getCenter(new THREE.Vector3());target.x=0;target.y-=.1;
    const direction=camera.position.clone().sub(controls.target).normalize(),right=new THREE.Vector3().crossVectors(camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
    const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*camera.aspect;let distance=0;
    for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z]){const r=new THREE.Vector3(x,y,z).sub(target);distance=Math.max(distance,Math.abs(r.dot(right))/tanH+r.dot(direction),Math.abs(r.dot(up))/tanV+r.dot(direction));}
    const position=direction.multiplyScalar(distance*1.1).add(target),duration=animate && !reducedMotion() ? .35 : 0;
    gsap.to(camera.position,{x:position.x,y:position.y,z:position.z,duration,ease:'power2.out',overwrite:true});gsap.to(controls.target,{x:target.x,y:target.y,z:target.z,duration,ease:'power2.out',overwrite:true});
  }
  function cancel(){if(active){active.cancelled=true;active.wake?.();active.cancelWait?.();}mechanics.reset();host.dataset.typebarStroke='0';}
  function tween(session,target,vars){return new Promise(resolve=>{const finish=()=>{session.cancelWait=null;resolve();};const animation=gsap.to(target,{...vars,duration:reducedMotion()?0:vars.duration,onComplete:finish});session.cancelWait=()=>{animation.kill();finish();};});}
  async function advance(session,event){
    if(event.ring&&!reducedMotion())ringPrinterBell();
    if(event.pageChanged){await tween(session,travel,{feed:PAGE_H+.7,duration:.6,ease:'power2.in',onUpdate:layoutPaper});if(session.cancelled)return;blank();travel.feed=0;layoutPaper();framedTop=0;}
    const progress={value:0},fromFeed=travel.feed,fromX=motion.x;
    await tween(session,progress,{value:1,duration:event.pageChanged ? .55 : event.ring ? .3 : .16,ease:'power2.inOut',onUpdate:()=>{
      travel.feed=THREE.MathUtils.lerp(fromFeed,feedForRow(event.row),progress.value);motion.x=THREE.MathUtils.lerp(fromX,leftStart,progress.value);layoutPaper();applyCarriage();
    }});
    if(session.cancelled)return;
    host.dataset.printedRows=String(event.page*32+event.row+1);host.dataset.carriageReturns=String(++session.returns);
    const top=paperPath(travel.feed).y;if(top>4.45&&Math.abs(top-framedTop)>.12){framedTop=top;framePaper();}
  }
  async function strike(session,event){
    const advanceWidth=ctx.measureText(event.char).width,target=carriageX(100+event.x+advanceWidth/2);
    if(Math.abs(motion.x-target)>.003)await tween(session,motion,{x:target,duration:.012,onUpdate:applyCarriage});
    const bar=event.char.trim()?mechanics.barFor(event.char):null,stroke={value:0};
    const pose=()=>{mechanics.setKey(event.char,stroke.value);if(bar)mechanics.setStroke(bar,stroke.value);host.dataset.typebarStroke=stroke.value.toFixed(2);};
    await tween(session,stroke,{value:1,duration:.025,ease:'power2.in',onUpdate:pose});if(session.cancelled)return;
    ctx.fillText(event.char,100+event.x,TOP+event.row*LINE);texture.needsUpdate=true;
    if(bar){host.dataset.typebarStrikes=String(++session.strikes);host.dataset.activeTypebar=bar.mesh.name;}
    const fromX=motion.x,toX=carriageX(100+event.x+advanceWidth+cell/2);
    await tween(session,stroke,{value:0,duration:.035,ease:'power2.out',onUpdate:()=>{pose();motion.x=THREE.MathUtils.lerp(toX,fromX,stroke.value);applyCarriage();}});
  }
  async function consume(session){
    try{
      const insertion={value:0};await tween(session,insertion,{value:1,duration:.6,ease:'power2.inOut',onUpdate:()=>{travel.feed=feedForRow(0)*insertion.value;motion.x=leftStart*insertion.value;layoutPaper();applyCarriage();}});framePaper();
      while(!session.cancelled){
        if(!session.queue.length){if(session.closed)break;await new Promise(resolve=>session.wake=resolve);session.wake=null;continue;}
        const batch=reducedMotion()?session.queue.length:session.queue.length>100?3:1;
        for(let i=0;i<batch&&session.queue.length&&!session.cancelled;i++){
          const char=session.queue.shift();
          for(const event of session.layout.push(char)){
            if(event.type==='line'){await advance(session,event);if(session.cancelled)break;}
            else await strike(session,event);
          }
        }

      }
      if(!session.cancelled)host.dataset.printState='complete';
      session.resolve();
    }catch(error){session.reject(error);}
  }
  function prepare(){
    cancel();if(!paper.visible)cameraSnapshot={position:camera.position.clone(),target:controls.target.clone()};
    paper.visible=true;travel.feed=0;motion.x=0;applyCarriage();blank();layoutPaper();framedTop=0;
    const session={queue:[],closed:false,cancelled:false,strikes:0,returns:0,layout:new PrintLayout(text=>ctx.measureText(text).width)};
    session.done=new Promise((resolve,reject)=>{session.resolve=resolve;session.reject=reject;});session.done.catch(()=>{});active=session;
    host.dataset.printState='printing';host.dataset.printedRows='1';host.dataset.typebarStrikes='0';host.dataset.carriageReturns='0';void consume(session);
  }
  function append(text){if(!active||active.closed||active.cancelled)throw new Error('The printer is not accepting text.');active.queue.push(...Array.from(text));active.wake?.();}
  async function finish(){if(!active)throw new Error('The printer has not started.');active.closed=true;active.wake?.();await active.done;}
  function clear(){cancel();paper.visible=false;host.dataset.printState='idle';host.dataset.paperFeed='0';if(cameraSnapshot){gsap.to(camera.position,{...cameraSnapshot.position,duration:reducedMotion()?0:.6,ease:'power2.inOut',overwrite:true});gsap.to(controls.target,{...cameraSnapshot.target,duration:reducedMotion()?0:.6,ease:'power2.inOut',overwrite:true});cameraSnapshot=null;}else restoreView();}
  return{prepare,append,finish,clear,async print(text){prepare();append(text);await finish();},resize:()=>framePaper(false),get visible(){return paper.visible;}};
}
