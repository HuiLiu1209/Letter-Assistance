import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as THREE from 'three';import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createTypewriterMechanics,paperPath,PRINT_POINT,ROLLER} from '../dist/mechanics.js';
async function machine(){const b=fs.readFileSync(new URL('../dist/assets/typewriter.glb',import.meta.url));return(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;}
function boxes(model){model.updateMatrixWorld(true);const result=new Map();model.traverse(o=>{if(o.isMesh)result.set(o.name,new THREE.Box3().setFromObject(o));});return result;}
function sameBoxes(before,after){for(const[name,box]of before){const other=after.get(name);assert.ok(other,`${name} missing`);assert.ok(box.min.distanceTo(other.min)<1e-6,`${name} min shifted`);assert.ok(box.max.distanceTo(other.max)<1e-6,`${name} max shifted`);}}
test('rigging preserves every source mesh at rest; carriage, roller and typebars reset cleanly',async()=>{
  const model=await machine(),before=boxes(model),m=createTypewriterMechanics(model);sameBoxes(before,boxes(model));assert.equal(m.bars.length,43);assert.ok(m.roller);
  const moving=before.get('carriage_inside').getCenter(new THREE.Vector3()),fixed=before.get('Frame_static').getCenter(new THREE.Vector3());
  m.setCarriage(1.25);m.setRoller(.5);m.setStroke(m.bars[8],.7);m.setKey('a',1);const during=boxes(model);
  assert.ok(Math.abs(during.get('carriage_inside').getCenter(new THREE.Vector3()).x-moving.x-1.25)<1e-6);
  assert.ok(during.get('Frame_static').getCenter(new THREE.Vector3()).distanceTo(fixed)<1e-6);assert.equal(m.roller.rotation.x,-.5/ROLLER.radius);
  m.reset();sameBoxes(before,boxes(model));
});
test('all 43 rigid typebars reach the same printing point without stretching geometry',async()=>{
  const model=await machine(),m=createTypewriterMechanics(model);
  for(const bar of m.bars){model.updateMatrixWorld(true);const local=bar.group.worldToLocal(bar.head.clone());m.setStroke(bar,1);model.updateMatrixWorld(true);const hit=bar.group.localToWorld(local);assert.ok(hit.distanceTo(PRINT_POINT)<1e-6,`${bar.mesh.name} misses the roller`);assert.deepEqual(bar.mesh.scale.toArray(),[1,1,1]);m.setStroke(bar,0);}
});
test('paper wraps around the actual roller, then rises behind it over the Underwood backplate',()=>{
  const first=paperPath(0);assert.ok(Math.hypot(first.y-PRINT_POINT.y,first.z-PRINT_POINT.z)<1e-6);
  const edge=paperPath(.65),back=paperPath(2);assert.ok(edge.z<ROLLER.z);assert.ok(back.z<-3);assert.ok(back.y>4);
  let last=first;for(let i=1;i<=600;i++){const next=paperPath(i*.01);assert.ok(next.y>=last.y-1e-5);assert.ok(next.z<=last.z+1e-5);assert.ok(Math.hypot(next.y-last.y,next.z-last.z)<.02);last=next;}
});
