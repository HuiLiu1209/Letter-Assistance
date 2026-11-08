import fs from 'node:fs';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';
globalThis.window={URL:globalThis.URL};
THREE.TextureLoader.prototype.load=function(url,onLoad){const t=new THREE.Texture(); t.name=url; onLoad?.(t); return t;};
globalThis.FileReader=class { readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});} readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});} };
const data=fs.readFileSync('source-assets/Final Model and Textures/SM_Typewriter_01.fbx');
const root=new FBXLoader().parse(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
const list=[];
root.traverse(o=>{if(o.isMesh){
 const mats=Array.isArray(o.material)?o.material:[o.material];
 list.push({name:o.name,vertices:o.geometry.attributes.position.count,position:o.position.toArray(),materials:mats.map(m=>({name:m.name,maps:Object.keys(m).filter(k=>m[k]?.isTexture).map(k=>[k,m[k].name])}))});
 o.material=mats.map(m=>new THREE.MeshStandardMaterial({name:m.name,color:0xffffff,metalness:.2,roughness:.6})); if(o.material.length===1)o.material=o.material[0];
}});
console.log(JSON.stringify({bounds:new THREE.Box3().setFromObject(root),children:list},null,2));
const result=await new GLTFExporter().parseAsync(root,{binary:true});
fs.writeFileSync('dist/assets/typewriter.glb',Buffer.from(result));
