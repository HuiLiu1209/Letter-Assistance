import {TypewriterAudio} from './vendor/platen/audio.js';
let engine;
// Call in the Send gesture, before awaiting model / network work (browser audio policy).
export function unlockPrinterAudio() {
  try {
    engine ||= new TypewriterAudio();
    engine.setMaster(.85);engine.setAmbience(null);
    return engine.unlock();
  } catch { return Promise.resolve(); }
}
export function ringPrinterBell() {
  try { engine?.bell(); } catch { /* Audio must never interrupt printing. */ }
}
