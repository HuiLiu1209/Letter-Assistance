import {DEFAULT_ROLE_ID,presets} from './roles.js';
const DEFAULTS_VERSION=2;
const KEY = 'letter-assistance.workspace.v1';
export function emptyWorkspace() {
  return {version: 1, defaultsVersion: DEFAULTS_VERSION, roles: [], letters: [], selectedRole: DEFAULT_ROLE_ID, model: 'gemini-3.5-flash-lite', draft: ''};
}
export function loadWorkspace(storage) {
  const clean = emptyWorkspace();
  try {
    const data = JSON.parse(storage.getItem(KEY));
    if (data?.version !== 1) return clean;
    clean.roles = (Array.isArray(data.roles) ? data.roles : []).filter(r => r && typeof r.id === 'string' && r.id.startsWith('custom-') && typeof r.name === 'string' && r.name.trim());
    clean.letters = (Array.isArray(data.letters) ? data.letters : []).filter(l => l && typeof l.id === 'string' && typeof l.text === 'string' && typeof l.title === 'string');
    // Apply the new General default once; keep later explicit role choices.
    if (data.defaultsVersion === DEFAULTS_VERSION && [...presets,...clean.roles].some(role=>role.id===data.selectedRole)) clean.selectedRole = data.selectedRole;
    if (typeof data.draft === 'string') clean.draft = data.draft.slice(0, 6000);
  } catch { /* Missing or corrupt storage starts a fresh workspace. */ }
  return clean;
}
export function saveWorkspace(storage, state) {
  try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
}
