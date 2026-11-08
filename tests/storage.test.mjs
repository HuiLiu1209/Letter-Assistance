import test from 'node:test';import assert from 'node:assert/strict';
import {emptyWorkspace,loadWorkspace,saveWorkspace} from '../dist/storage.js';
const memory=()=>{const items=new Map();return {getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v)};};
test('completed letters and role snapshots survive a browser reload',()=>{
  const storage=memory(),state=emptyWorkspace(),role={id:'custom-test',name:'My card',purpose:'Old purpose'};
  state.roles.push(role);state.letters.push({id:'letter-one',title:'For Alex',text:'Dear Alex, thank you.',role:{...role},createdAt:'2026-11-08T00:00:00Z'});role.purpose='New purpose';state.draft='Next letter';
  assert.equal(saveWorkspace(storage,state),true);const restored=loadWorkspace(storage);assert.equal(restored.letters[0].role.purpose,'Old purpose');assert.equal(restored.roles[0].purpose,'New purpose');assert.equal(restored.draft,'Next letter');
});
test('corrupt storage is recoverable and quota errors are visible to callers',()=>{
  assert.deepEqual(loadWorkspace({getItem:()=>'{bad'}),emptyWorkspace());
  assert.equal(saveWorkspace({setItem:()=>{throw Error('Quota exceeded');}},emptyWorkspace()),false);
});
test('General becomes the new default without losing letters, cards or future explicit choices',()=>{
  const storage=memory(),legacy={version:1,roles:[{id:'custom-kept',name:'Personal'}],letters:[{id:'kept',title:'My letter',text:'Existing letter'}],selectedRole:'resignation',draft:'Unsent request'};
  storage.setItem('letter-assistance.workspace.v1',JSON.stringify(legacy));const migrated=loadWorkspace(storage);
  assert.equal(migrated.selectedRole,'general');assert.equal(migrated.letters[0].text,'Existing letter');assert.equal(migrated.roles[0].name,'Personal');assert.equal(migrated.draft,'Unsent request');
  migrated.selectedRole='thank-you';saveWorkspace(storage,migrated);assert.equal(loadWorkspace(storage).selectedRole,'thank-you');
});
