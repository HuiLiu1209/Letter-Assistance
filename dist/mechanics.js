import * as THREE from 'three';
// Calibrated from the original model's roller component, in its exported world coordinates.
export const ROLLER={y:3.4255,z:-1.9682,radius:.405,beta:.23,gamma:1.18};
export const PRINT_POINT=new THREE.Vector3(0,ROLLER.y+ROLLER.radius*Math.sin(ROLLER.beta),ROLLER.z+ROLLER.radius*Math.cos(ROLLER.beta));
const DS=.01,path=[];
const wrap=(ROLLER.gamma-ROLLER.beta)*ROLLER.radius;
let py=0,pz=0;
for(let i=0;i<=1800;i++){
  const s=i*DS;
  if(s<=wrap){const angle=ROLLER.beta+s/ROLLER.radius;py=ROLLER.y+ROLLER.radius*Math.sin(angle);pz=ROLLER.z+ROLLER.radius*Math.cos(angle);}
  else {const over=s-wrap,blend=THREE.MathUtils.smoothstep(over,1.45,2.65),angle=THREE.MathUtils.lerp(ROLLER.gamma,.44,blend);py+=Math.cos(angle)*DS;pz-=Math.sin(angle)*DS;}
  path.push([py,pz]);
}
export function paperPath(s){
  if(s<0){const a=ROLLER.beta+s/ROLLER.radius;return{y:ROLLER.y+ROLLER.radius*Math.sin(a),z:ROLLER.z+ROLLER.radius*Math.cos(a)};}
  const f=Math.min(s/DS,path.length-1.00001),i=Math.floor(f),t=f-i;return{y:THREE.MathUtils.lerp(path[i][0],path[i+1][0],t),z:THREE.MathUtils.lerp(path[i][1],path[i+1][1],t)};
}
export function createTypewriterMechanics(model){
  model.updateMatrixWorld(true);
  const carriage=new THREE.Group();carriage.name='moving-carriage';model.add(carriage);
  const movable=[];model.traverse(o=>{if(o.isMesh&&o.userData.carriage)movable.push(o);});for(const o of movable)carriage.attach(o);
  const roller=model.getObjectByName('platen_roller'),keys=new Map(),bars=[];
  model.traverse(o=>{if(o.isMesh&&o.userData.char)keys.set(o.userData.char.toLowerCase(),{mesh:o,y:o.position.y});if(o.isMesh&&o.userData.bar)bars.push(o);});
  const specs=bars.map(mesh=>{
    const position=mesh.geometry.attributes.position,points=[];for(let i=0;i<position.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld));
    const box=new THREE.Box3().setFromPoints(points),headPoints=points.filter(p=>p.z>box.max.z-.1),head=headPoints.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/headPoints.length);
    const rear=points.filter(p=>p.z<box.min.z+.08),x=rear.reduce((sum,p)=>sum+p.x,0)/rear.length,z=box.min.z+.02;
    // A rigid hinge calibrated so the existing slug reaches the same fixed print point.
    const y=(PRINT_POINT.lengthSq()-head.lengthSq()-2*x*(PRINT_POINT.x-head.x)-2*z*(PRINT_POINT.z-head.z))/(2*(PRINT_POINT.y-head.y));
    const pivot=new THREE.Vector3(x,y,z),group=new THREE.Group();group.name=`hinge-${mesh.name}`;group.position.copy(pivot);model.add(group);group.attach(mesh);
    const rest=head.clone().sub(pivot),hit=PRINT_POINT.clone().sub(pivot),quaternion=new THREE.Quaternion().setFromUnitVectors(rest.clone().normalize(),hit.clone().normalize());
    return{mesh,group,head,pivot,quaternion,rest};
  }).sort((a,b)=>a.pivot.x-b.pivot.x||a.pivot.y-b.pivot.y);
  const characters='1234567890qwertyuiopasdfghjklzxcvbnm,.;/-';
  const identity=new THREE.Quaternion();let lastBar=null;
  function setCarriage(x){carriage.position.x=x;}
  function setRoller(feed){if(roller)roller.rotation.x=-feed/ROLLER.radius;}
  function barFor(char){let index=characters.indexOf(char.toLowerCase());if(index<0)index=char.codePointAt(0)%specs.length;return specs[index%specs.length];}
  function setStroke(bar,amount){bar.group.quaternion.slerpQuaternions(identity,bar.quaternion,amount);lastBar=bar;}
  function setKey(char,amount){const key=keys.get(char.toLowerCase())||keys.get(' ');if(key)key.mesh.position.y=key.y-amount*.085;}
  function reset(){carriage.position.x=0;if(roller)roller.rotation.x=0;for(const spec of specs)spec.group.quaternion.identity();for(const{mesh,y}of keys.values())mesh.position.y=y;lastBar=null;}
  return{carriage,roller,keys,bars:specs,setCarriage,setRoller,barFor,setStroke,setKey,reset,get lastBar(){return lastBar;}};
}
