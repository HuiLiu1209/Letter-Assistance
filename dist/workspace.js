import {printerReady} from './app.js';
import {presets, roleFields} from './roles.js';
import {loadWorkspace, saveWorkspace} from './storage.js';
const gsap = window.gsap;
const $ = id => document.getElementById(id);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let storage;
try { storage = localStorage; } catch { storage = {getItem:()=>null,setItem:()=>{throw new Error('Storage unavailable');}}; }
const state = loadWorkspace(storage);
const allRoles = () => [...presets, ...state.roles];
const selectedRole = () => allRoles().find(r => r.id === state.selectedRole) || presets[1];
let busy = false, editingRole = null, noticeTimer;
function notice(message, temporary = false) {
  clearTimeout(noticeTimer); $('composer-notice').textContent = message; $('composer-notice').hidden = !message;
  if (temporary) noticeTimer = setTimeout(()=>notice(''), 5000);
}
function persist() {
  if (!saveWorkspace(storage, state)) notice('Browser storage is unavailable or full. Keep this page open; new letters cannot be saved after you close it.');
}
function animateFold(name, open) {
  const toggle = $(`${name}-toggle`), panel = $(`${name}-panel`), card = $(`${name}-card`);
  toggle.setAttribute('aria-expanded', String(open)); panel.inert = !open; card.classList.toggle('is-open', open);
  if (name === 'instructions') {
    $('instructions-label').textContent = 'Role Card';
  }
  gsap.killTweensOf(panel); panel.style.visibility = 'visible';
  gsap.to(toggle.querySelector('.caret'), {rotation:open?180:0,duration:reducedMotion()?0:.25,ease:'power2.out',overwrite:true});
  gsap.to(panel, {height:open?panel.firstElementChild.getBoundingClientRect().height:0,duration:reducedMotion()?0:.32,ease:'power2.inOut',onComplete:()=>{
    if (open) panel.style.height = 'auto'; else panel.style.visibility = 'hidden';
  }});
}
for (const name of ['instructions','letters']) $(`${name}-toggle`).addEventListener('click', ()=>animateFold(name, $(`${name}-toggle`).getAttribute('aria-expanded') !== 'true'));
function syncComposer() {
  const role = selectedRole(); $('letter-request').placeholder = `Work with ${role.name}`; $('diagram-role').textContent = role.name;
}
function icon(file) {const image=document.createElement('img');image.src=`./assets/ui/${file}.svg`;image.alt='';return image;}
function renderRoles() {
  for (const [list, roles] of [[$('preset-list'),presets],[$('custom-list'),state.roles]]) {
    list.replaceChildren();
    list.classList.toggle('is-empty',roles.length===0);
    if (!roles.length) {const p=document.createElement('p');p.className='empty-state';p.textContent='No custom roles yet.';list.append(p);}
    for (const role of roles) {
      const row=document.createElement('div');row.className='role-row';row.dataset.selected=String(role.id===selectedRole().id);
      const button=document.createElement('button');button.type='button';button.className='role-select';button.textContent=role.name;button.title=`View ${role.name} Role Card`;button.setAttribute('aria-pressed',String(role.id===selectedRole().id));button.addEventListener('click',()=>openRole(role));row.append(button);
      if (role.id.startsWith('custom-')) {const edit=document.createElement('button');edit.type='button';edit.className='role-edit';edit.setAttribute('aria-label',`Edit ${role.name}`);edit.append(icon('note-pencil'));edit.addEventListener('click',()=>openRole(role));row.append(edit);}
      list.append(row);
    }
  }
  syncComposer();
}
function showDialog(dialog) {
  dialog.showModal(); gsap.fromTo(dialog,{opacity:0,y:12},{opacity:1,y:0,duration:reducedMotion()?0:.22,ease:'power2.out',overwrite:true});
}
function closeDialog(dialog, afterClose) {
  gsap.to(dialog,{opacity:0,y:8,duration:reducedMotion()?0:.16,ease:'power2.in',overwrite:true,onComplete:()=>{dialog.close();afterClose?.();}});
}
for (const dialog of document.querySelectorAll('.workspace-dialog')) {
  dialog.querySelector('.close-dialog').addEventListener('click',()=>closeDialog(dialog));
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) closeDialog(dialog);}});
}
function openRole(role = null) {
  editingRole = role; const preset=role && !role.id.startsWith('custom-'); $('role-dialog-title').textContent = role ? role.name : 'New Role Card';
  $('save-role').textContent = preset ? 'Use this role' : 'Save & use'; $('role-error').textContent='';$('role-fields').replaceChildren();
  for (const [key,label] of roleFields) {
    const wrapper=document.createElement('label');wrapper.className='role-field';const title=document.createElement('span');title.textContent=label;
    const field=document.createElement(key==='name'?'input':'textarea');field.name=key;field.value=role?.[key]||'';field.required=true;field.maxLength=key==='name'?80:2000;field.readOnly=!!preset;
    if(key!=='name') field.rows=3;wrapper.append(title,field);$('role-fields').append(wrapper);
  }
  showDialog($('role-dialog'));$('role-dialog').scrollTop=0;
}
$('new-role').addEventListener('click',()=>openRole());
$('add-custom-role').addEventListener('click',()=>openRole());
$('role-form').addEventListener('submit',event=>{
  event.preventDefault();
  if (editingRole && !editingRole.id.startsWith('custom-')) state.selectedRole=editingRole.id;
  else {
    const values=Object.fromEntries(new FormData(event.currentTarget));
    for(const [key] of roleFields) if(!values[key]?.trim()) {$('role-error').textContent='Complete all eight fields.';return;}
    const role={id:editingRole?.id||`custom-${crypto.randomUUID()}`,...Object.fromEntries(roleFields.map(([key])=>[key,values[key].trim()]))};
    const index=state.roles.findIndex(r=>r.id===role.id);if(index<0)state.roles.push(role);else state.roles[index]=role;state.selectedRole=role.id;
  }
  persist();renderRoles();closeDialog($('role-dialog'),()=>$('letter-request').focus());
});
function renderLetters() {
  $('letter-list').replaceChildren();
  $('letter-list').classList.toggle('is-empty',state.letters.length===0);
  if (!state.letters.length) {const p=document.createElement('p');p.className='empty-state';p.textContent='Your finished letters will appear here.';$('letter-list').append(p);return;}
  for (const letter of state.letters) {
    const button=document.createElement('button');button.type='button';button.className='letter-row';
    const title=document.createElement('strong');title.textContent=letter.title;const date=document.createElement('span');date.textContent=new Date(letter.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
    button.append(title,date);button.addEventListener('click',()=>{
      $('letter-title').textContent=letter.title;$('letter-meta').textContent=`${date.textContent} · Saved letter · Read only`;$('letter-text').textContent=letter.text;showDialog($('letter-dialog'));$('letter-dialog').scrollTop=0;
    });$('letter-list').append(button);
  }
}
$('system-diagram').addEventListener('click',()=>showDialog($('diagram-dialog')));
const modelMenu=$('model-menu');
function closeModelMenu() {modelMenu.hidden=true;$('model-picker').setAttribute('aria-expanded','false');}
$('model-picker').addEventListener('click',()=>{const open=modelMenu.hidden;modelMenu.hidden=!open;$('model-picker').setAttribute('aria-expanded',String(open));if(open)gsap.fromTo(modelMenu,{opacity:0,y:5},{opacity:1,y:0,duration:reducedMotion()?0:.18});});
modelMenu.querySelector('button').addEventListener('click',closeModelMenu);
document.addEventListener('click',event=>{if(!event.target.closest('.model-picker')&&!modelMenu.contains(event.target))closeModelMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeModelMenu();});
function resizeInput() {const input=$('letter-request');input.style.height='auto';input.style.height=`${Math.min(parseFloat(getComputedStyle(input).maxHeight),input.scrollHeight)}px`;}
$('letter-request').value=state.draft;resizeInput();
$('letter-request').addEventListener('input',()=>{state.draft=$('letter-request').value;persist();resizeInput();});
$('letter-request').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(!busy)$('letter-form').requestSubmit();}});
$('letter-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const request=$('letter-request').value.trim();if(!request){$('letter-request').focus();return;}
  const role={...selectedRole()};busy=true;$('send-letter').disabled=true;$('letter-request').readOnly=true;$('letter-form').setAttribute('aria-busy','true');
  let printer;
  try {
    notice('Preparing your letter…');printer=await printerReady;printer.prepare();
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request,role,model:state.model}),signal:AbortSignal.timeout(55000)});
    let result;try{result=await response.json();}catch{throw new Error('The AI connection is unavailable. Your request is kept here; please try again.');}
    if(!response.ok)throw new Error(result.error||'Unable to write this letter. Please try again.');
    if(typeof result.text!=='string'||!result.text.trim())throw new Error('No letter was returned. Please try again.');
    const firstLine=request.split('\n').find(Boolean)||role.name;
    const letter={id:crypto.randomUUID(),title:firstLine.length>48?`${firstLine.slice(0,48)}…`:firstLine,role:{...role},model:state.model,request,text:result.text,createdAt:new Date().toISOString()};
    state.letters.unshift(letter);state.draft='';$('letter-request').value='';resizeInput();const saved=saveWorkspace(storage,state);renderLetters();
    notice('Printing…');await printer.print(result.text);
    notice(saved?'Saved in Letters.':'Printed, but browser storage is unavailable or full. Keep this page open to retain this letter.',saved);
  } catch(error) {
    printer?.clear();notice(error.name==='TimeoutError'?'The model took too long. Your request is kept here; please try again.':error.message||'Unable to write this letter. Please try again.');
  } finally {
    busy=false;$('send-letter').disabled=false;$('letter-request').readOnly=false;$('letter-form').removeAttribute('aria-busy');
  }
});
renderRoles();renderLetters();
// Report scene failures even before the first request without an unhandled rejection.
printerReady.catch(()=>notice('The typewriter could not load. Please refresh this page.'));
