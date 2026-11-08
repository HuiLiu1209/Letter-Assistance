import * as THREE from 'three';
const gsap = window.gsap;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Word wrapping uses the actual canvas font and splits overlong words / CJK safely.
export function wrapLetter(ctx, text, width) {
  const lines = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    for (const token of paragraph.match(/\S+\s*|\s+/gu) || ['']) {
      if (ctx.measureText(line + token).width <= width) { line += token; continue; }
      if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
      for (const char of Array.from(token.trimStart())) {
        if (line && ctx.measureText(line + char).width > width) { lines.push(line.trimEnd()); line = ''; }
        line += char;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
export function createPaperPrinter({scene, model, camera, controls, restoreView}) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1448;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({map: texture, color: 0xffffff, roughness: .95, metalness: 0, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: .55});
  const width = 4.4, height = 6.22;
  const geometry = new THREE.PlaneGeometry(width, height, 16, 32); geometry.translate(0, height / 2, 0);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, -.1 * Math.sin(y / height * Math.PI)); }
  geometry.computeVertexNormals();
  const paper = new THREE.Mesh(geometry, material); paper.position.set(0, 3.53, -1.44); paper.rotation.x = -.16;
  paper.castShadow = true; paper.receiveShadow = true; paper.visible = false; scene.add(paper);
  const keys = new Map(); model.traverse(o => {if(o.userData.char) keys.set(o.userData.char.toLowerCase(), {mesh:o, y:o.position.y});});
  let timeline, lastStrike = -1, lastCount = -1, cameraSnapshot;
  function draw(lines = [], count = 0, pageNumber = 1, pageCount = 1) {
    ctx.fillStyle = '#f0e7d4'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1e1a16'; ctx.font = '600 28px "Courier New", monospace'; ctx.textBaseline = 'top';
    let left = count;
    for (let i = 0; i < lines.length && left > 0; i++) {
      const chars = Array.from(lines[i]); ctx.fillText(chars.slice(0, left).join(''), 100, 118 + i * 37); left -= chars.length + 1;
    }
    if (pageCount > 1) { ctx.fillStyle = '#8b806b'; ctx.font = '19px "Courier New", monospace'; ctx.fillText(`${pageNumber} / ${pageCount}`, 870, 1370); }
    texture.needsUpdate = true;
  }
  function framePaper(animate = true) {
    const bounds = new THREE.Box3().setFromObject(model).union(new THREE.Box3().setFromObject(paper));
    const target = bounds.getCenter(new THREE.Vector3()); target.y -= .1;
    const direction = camera.position.clone().sub(controls.target).normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize(), up = new THREE.Vector3().crossVectors(direction, right);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
    let distance = 0;
    for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
      const r = new THREE.Vector3(x,y,z).sub(target); distance = Math.max(distance, Math.abs(r.dot(right))/tanH+r.dot(direction), Math.abs(r.dot(up))/tanV+r.dot(direction));
    }
    const position = direction.multiplyScalar(distance * 1.1).add(target);
    gsap.to(camera.position, {x:position.x,y:position.y,z:position.z,duration:animate && !reducedMotion() ? .8 : 0,ease:'power2.inOut',overwrite:true});
    gsap.to(controls.target, {x:target.x,y:target.y,z:target.z,duration:animate && !reducedMotion() ? .8 : 0,ease:'power2.inOut',overwrite:true});
  }
  function stop() {timeline?.kill(); for(const {mesh,y} of keys.values()) {gsap.killTweensOf(mesh.position);mesh.position.y=y;}}
  function prepare() {
    stop();
    if (!paper.visible) cameraSnapshot = {position:camera.position.clone(), target:controls.target.clone()};
    paper.visible = true; paper.scale.y = 1; draw(); framePaper();
    gsap.fromTo(paper.scale, {y:.015}, {y:1, duration:reducedMotion()?0:.85, ease:'power2.out', overwrite:true});
  }
  function clear() {
    stop(); gsap.killTweensOf(paper.scale); paper.visible = false;
    if (cameraSnapshot) {
      gsap.to(camera.position, {...cameraSnapshot.position, duration:reducedMotion()?0:.6,ease:'power2.inOut',overwrite:true});
      gsap.to(controls.target, {...cameraSnapshot.target, duration:reducedMotion()?0:.6,ease:'power2.inOut',overwrite:true}); cameraSnapshot = null;
    } else restoreView();
  }
  async function print(text) {
    if (!paper.visible) prepare();
    ctx.font = '600 28px "Courier New", monospace';
    const lines = wrapLetter(ctx, text, 824), pages = [];
    for (let i=0;i<lines.length;i+=32) pages.push(lines.slice(i,i+32));
    for (let page=0;page<pages.length;page++) {
      const rows = pages[page], content = rows.join('\n'), chars = Array.from(content), progress = {count:0}; lastCount = lastStrike = -1;
      if (page) await gsap.fromTo(paper.scale, {y:.015}, {y:1,duration:reducedMotion()?0:.6,ease:'power2.out'});
      await new Promise(resolve => {
        timeline = gsap.to(progress, {count:chars.length, duration:reducedMotion()?0:Math.min(18,Math.max(3,chars.length/85)),ease:'none',onUpdate:()=>{
          const count = Math.floor(progress.count); if (count === lastCount) return; lastCount=count;
          draw(rows,count,page+1,pages.length);
          if (!reducedMotion() && Math.floor(count/4)!==lastStrike) {
            lastStrike=Math.floor(count/4);const key=keys.get((chars[Math.max(0,count-1)]||' ').toLowerCase())||keys.get(' ');
            if (key) gsap.fromTo(key.mesh.position,{y:key.y},{y:key.y-.065,duration:.055,repeat:1,yoyo:true,overwrite:true});
          }
        },onComplete:()=>{draw(rows,chars.length+1,page+1,pages.length);resolve();}});
      });
    }
    stop();
  }
  return {prepare, print, clear, resize:()=>framePaper(false), get visible(){return paper.visible;}};
}
