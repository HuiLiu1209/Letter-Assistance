import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

// This version is entirely a scene study. No writing UI, added paper or key animation.
const host=document.getElementById('scene');
const status=document.getElementById('status');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x080808);
const camera=new THREE.PerspectiveCamera(34,1,.1,120);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.95;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
host.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Underwood 三维打字机，红色桌布和暖色三点打光。拖动查看模型。');

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.065;
controls.enablePan=false;controls.rotateSpeed=.65;controls.zoomSpeed=.65;
controls.minPolarAngle=.28;controls.maxPolarAngle=Math.PI*.48;
controls.target.set(0,1.7,0);
const initialDirection=new THREE.Vector3(-.61,.49,.79).normalize();
camera.position.copy(initialDirection).multiplyScalar(16).add(controls.target);
controls.update();
let model=null,lastFitDistance=null;

// Three reflection cards correspond to the three actual studio lights below.
// The surrounding environment stays dark, preserving the original dark paint.
const studio=new THREE.Scene();studio.background=new THREE.Color(0x030303);
function reflectionCard(position,target,size,radiance,color){
  const card=new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(radiance),side:THREE.DoubleSide}));
  card.position.set(...position);card.lookAt(new THREE.Vector3(...target));studio.add(card);
}
reflectionCard([-5,9,6],[0,1.6,0],[6,7],3,0xffd9ab); // broad warm key
reflectionCard([-6,4,-5],[0,2,0],[1.3,7],2.2,0xffd09c); // narrow rim
reflectionCard([3,8,0],[.9,3.4,-1.7],[2.2,2.2],5,0xffc481); // focused highlight
const pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(studio,.025).texture;
studio.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});pmrem.dispose();

// 1. Large main light: the broad front/left face and warm tabletop shadows.
const key=new THREE.SpotLight(0xffd8aa,185,36,.79,.85,2);
key.position.set(-5,9,6);key.target.position.set(0,1.45,0);
key.castShadow=true;key.shadow.mapSize.set(4096,4096);
key.shadow.camera.near=.5;key.shadow.camera.far=32;
key.shadow.normalBias=.012;key.shadow.bias=-.00008;key.shadow.radius=3;
scene.add(key,key.target);
// 2. Narrow rear light: warm contours on the frame, feet and carriage edges.
const rim=new THREE.SpotLight(0xffd09c,100,30,.56,.8,2);
rim.position.set(-6,4,-5);rim.target.position.set(0,1.9,0);
rim.castShadow=true;rim.shadow.mapSize.set(2048,2048);
rim.shadow.camera.near=.5;rim.shadow.camera.far=24;
rim.shadow.normalBias=.018;rim.shadow.bias=-.0001;rim.shadow.radius=2;
scene.add(rim,rim.target);
// 3. Tight upper-right light: the upper backplate and roller get the focal highlight.
const accent=new THREE.SpotLight(0xffc488,115,25,.34,.85,2);
accent.position.set(3.4,7,1);accent.target.position.set(1.3,3.7,-2.65);
accent.castShadow=true;accent.shadow.mapSize.set(2048,2048);
accent.shadow.camera.near=.5;accent.shadow.camera.far=20;
accent.shadow.normalBias=.012;accent.shadow.bias=-.00008;accent.shadow.radius=2;
scene.add(accent,accent.target);

// A woven red cloth over a circular table. UVs stay in tabletop metres so that
// the weave remains the same size across the flat top, rolled edge and hanging folds.
function wovenTextures(){
  const size=512,color=document.createElement('canvas'),height=document.createElement('canvas');
  color.width=color.height=height.width=height.height=size;
  const c=color.getContext('2d'),h=height.getContext('2d');
  const rgb=c.createImageData(size,size),bump=h.createImageData(size,size);
  let seed=1367;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,warp=Math.cos(x*Math.PI/4),weft=Math.cos(y*Math.PI/4);
    const over=((x>>3)+(y>>3))%2,thread=over?warp*.62+weft*.22:weft*.62+warp*.22;
    const variation=thread*.11+(random()-.5)*.10+Math.sin(x*.039+Math.sin(y*.017))*.025;
    rgb.data[i]=Math.max(0,76*(1+variation));rgb.data[i+1]=Math.max(0,23*(1+variation));rgb.data[i+2]=Math.max(0,17*(1+variation));rgb.data[i+3]=255;
    const raised=128+thread*42+(random()-.5)*11;
    bump.data[i]=bump.data[i+1]=bump.data[i+2]=raised;bump.data[i+3]=255;
  }
  c.putImageData(rgb,0,0);h.putImageData(bump,0,0);
  const albedo=new THREE.CanvasTexture(color),relief=new THREE.CanvasTexture(height);
  albedo.colorSpace=THREE.SRGBColorSpace;
  for(const t of [albedo,relief]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),16);t.repeat.set(8,8);}
  return{albedo,relief};
}
const fabric=wovenTextures();
const clothMaterial=new THREE.MeshPhysicalMaterial({map:fabric.albedo,bumpMap:fabric.relief,bumpScale:.006,roughness:.95,metalness:0,sheen:.24,sheenColor:new THREE.Color(0x713126),sheenRoughness:.86,side:THREE.DoubleSide,envMapIntensity:.12});
function clothGeometry(){
  const angular=256,rings=100,positions=[],uvs=[],indices=[];
  for(let row=0;row<=rings;row++){
    const t=row/rings;let radius,y;
    if(t<.7){radius=t/.7*6.1;y=-.028;}
    else if(t<.78){const a=(t-.7)/.08*Math.PI/2;radius=6.1+Math.sin(a)*.22;y=-.028-(1-Math.cos(a))*.22;}
    else{const drop=(t-.78)/.22;radius=6.32+drop*.35;y=-.248-drop*2.35;}
    for(let col=0;col<=angular;col++){
      const a=col/angular*Math.PI*2;
      const edge=THREE.MathUtils.smoothstep(radius,4.9,6.3),fall=THREE.MathUtils.smoothstep(t,.76,1);
      const pleat=Math.sin(a*17+.65)*.075+Math.sin(a*29+1.8)*.035+Math.sin(a*9-.3)*.055;
      const r=radius+pleat*fall;
      const ripple=(Math.sin(a*5+radius*2.1)*.009+Math.sin(a*11-radius*2.6)*.006)*edge;
      const seam=.012*Math.sin(a*3+radius*1.2)*edge;
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      const creaseDistance=z-4.35-.14*x;
      const fold=t<.7?.085*Math.exp(-creaseDistance*creaseDistance/.075)-.023*Math.exp(-((creaseDistance-.34)**2)/.16):0;
      positions.push(x,y+ripple+seam+fold,z);
      uvs.push(.5+Math.cos(a)*radius/13.4,.5+Math.sin(a)*radius/13.4+(t>.78?(t-.78)*.9:0));
    }
  }
  for(let row=0;row<rings;row++)for(let col=0;col<angular;col++){
    const a=row*(angular+1)+col,b=a+angular+1;indices.push(a,a+1,b,b,a+1,b+1);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
const cloth=new THREE.Mesh(clothGeometry(),clothMaterial);cloth.castShadow=true;cloth.receiveShadow=true;scene.add(cloth);

// Original 4096x4096 maps, with every source texel intact.
const manager=new THREE.LoadingManager(),textureLoader=new THREE.TextureLoader(manager);
function texture(name,srgb=false){
  const t=textureLoader.load(`./assets/original-4k/${name}.png`);
  t.flipY=true;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),16);
  t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;return t;
}
const materials={};
for(const name of ['Frame','Inside','Keys']){
  const map=texture(`T_${name}_ALB`,true),normal=texture(`T_${name}_NRM`),rma=texture(`T_${name}_RMA`);
  const material=new THREE.MeshStandardMaterial({name,map,normalMap:normal,normalScale:new THREE.Vector2(1,-1),roughnessMap:rma,metalnessMap:rma,aoMap:rma,aoMapIntensity:1,roughness:1,metalness:1,envMapIntensity:.35});
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <roughnessmap_fragment>',THREE.ShaderChunk.roughnessmap_fragment.replace('texelRoughness.g','texelRoughness.r'))
      .replace('#include <metalnessmap_fragment>',THREE.ShaderChunk.metalnessmap_fragment.replace('texelMetalness.b','texelMetalness.g'))
      .replace('#include <aomap_fragment>',THREE.ShaderChunk.aomap_fragment.replace('vAoMapUv ).r','vAoMapUv ).b'));
  };
  material.customProgramCacheKey=()=> 'original-rma-r-g-b-v1';materials[name]=material;
}
manager.onProgress=(_,done,total)=>{status.textContent=`正在载入打字机与原始贴图，${Math.round(done/total*100)}%。`;};
const texturesReady=new Promise((resolve,reject)=>{manager.onLoad=resolve;manager.onError=url=>reject(new Error(`Unable to load ${url}`));});
const modelReady=new GLTFLoader().loadAsync('./assets/typewriter.glb');

function fitToModel(preserveZoom=false){
  if(!model)return;
  const bounds=new THREE.Box3().setFromObject(model),direction=camera.position.clone().sub(controls.target).normalize();
  const right=new THREE.Vector3().crossVectors(camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
  const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*camera.aspect;
  let distance=0;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const relative=new THREE.Vector3(x,y,z).sub(controls.target),depth=relative.dot(direction);
    distance=Math.max(distance,Math.abs(relative.dot(right))/tanH+depth,Math.abs(relative.dot(up))/tanV+depth);
  }
  distance*=1.11;
  const zoom=preserveZoom&&lastFitDistance?camera.position.distanceTo(controls.target)/lastFitDistance:1;
  lastFitDistance=distance;camera.position.copy(direction).multiplyScalar(distance*zoom).add(controls.target);
  controls.minDistance=distance*.55;controls.maxDistance=distance*2.2;controls.update();
}
function resize(){const {width,height}=host.getBoundingClientRect();camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);fitToModel(true);}
new ResizeObserver(resize).observe(host);resize();
Promise.all([modelReady,texturesReady]).then(([gltf])=>{
  model=gltf.scene;
  model.traverse(o=>{if(!o.isMesh)return;o.material=materials[o.material.name]||materials.Frame;
    if(o.geometry.attributes.uv&&!o.geometry.attributes.uv1)o.geometry.setAttribute('uv1',o.geometry.attributes.uv);
    o.castShadow=true;o.receiveShadow=true;
  });
  scene.add(model);fitToModel();
  renderer.render(scene,camera);document.body.classList.add('ready');
  status.textContent='打字机场景已准备好。';host.dataset.ready='true';
}).catch(error=>{console.error(error);document.body.classList.add('failed');status.textContent='模型未能载入，请刷新重试。';});
function render(){requestAnimationFrame(render);controls.update();renderer.render(scene,camera);}render();
