// Synthesised sound for Gullwing Courier: engine drone, wind, chimes and
// thuds, all made with the Web Audio API. No audio files are loaded.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc1: null,
    engineOsc2: null,
    engineGain: null,
    windSrc: null,
    windGain: null,
    windFilter: null,
    muted: false,
    started: false,
  };
}

// Must be called from a user gesture (click / keypress) — browsers block
// AudioContext before one.
export function startAudio(a) {
  if (a.started) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  a.ctx = new Ctx();
  a.master = a.ctx.createGain();
  a.master.gain.value = a.muted ? 0 : 0.5;
  a.master.connect(a.ctx.destination);

  a.engineOsc1 = a.ctx.createOscillator();
  a.engineOsc1.type = 'sawtooth';
  a.engineOsc1.frequency.value = 55;
  a.engineOsc2 = a.ctx.createOscillator();
  a.engineOsc2.type = 'square';
  a.engineOsc2.frequency.value = 82;
  const engineFilter = a.ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 420;
  a.engineGain = a.ctx.createGain();
  a.engineGain.gain.value = 0;
  a.engineOsc1.connect(engineFilter);
  a.engineOsc2.connect(engineFilter);
  engineFilter.connect(a.engineGain);
  a.engineGain.connect(a.master);
  a.engineOsc1.start();
  a.engineOsc2.start();

  // Wind: a looped noise buffer through a bandpass.
  const len = a.ctx.sampleRate * 2;
  const buffer = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  a.windSrc = a.ctx.createBufferSource();
  a.windSrc.buffer = buffer;
  a.windSrc.loop = true;
  a.windFilter = a.ctx.createBiquadFilter();
  a.windFilter.type = 'bandpass';
  a.windFilter.frequency.value = 700;
  a.windFilter.Q.value = 0.6;
  a.windGain = a.ctx.createGain();
  a.windGain.gain.value = 0;
  a.windSrc.connect(a.windFilter);
  a.windFilter.connect(a.windGain);
  a.windGain.connect(a.master);
  a.windSrc.start();

  a.started = true;
}

// Called every frame: engine pitch follows throttle, wind follows speed.
export function updateAudio(a, throttle, speed, onGround) {
  if (!a.started) return;
  const t = a.ctx.currentTime;
  a.engineOsc1.frequency.setTargetAtTime(48 + throttle * 70, t, 0.1);
  a.engineOsc2.frequency.setTargetAtTime(72 + throttle * 105, t, 0.1);
  a.engineGain.gain.setTargetAtTime(onGround ? 0.05 + throttle * 0.1 : 0.08 + throttle * 0.12, t, 0.1);
  const wind = Math.min(1, speed / 90);
  a.windGain.gain.setTargetAtTime(wind * wind * 0.22, t, 0.15);
  a.windFilter.frequency.setTargetAtTime(500 + speed * 9, t, 0.15);
}

function blip(a, freq, start, dur, vol, type) {
  if (!a.started) return;
  const o = a.ctx.createOscillator();
  o.type = type || 'sine';
  o.frequency.value = freq;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(vol, a.ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, a.ctx.currentTime + start + dur);
  o.connect(g);
  g.connect(a.master);
  o.start(a.ctx.currentTime + start);
  o.stop(a.ctx.currentTime + start + dur + 0.05);
}

export function playRingChime(a) {
  blip(a, 880, 0, 0.35, 0.25);
  blip(a, 1318, 0.09, 0.4, 0.22);
}

export function playLandThud(a) {
  blip(a, 70, 0, 0.3, 0.4, 'triangle');
  blip(a, 140, 0.02, 0.2, 0.2, 'sine');
}

export function playCrash(a) {
  if (!a.started) return;
  const len = a.ctx.sampleRate * 0.5;
  const buffer = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  const g = a.ctx.createGain();
  g.gain.value = 0.6;
  src.connect(filter);
  filter.connect(g);
  g.connect(a.master);
  src.start();
  blip(a, 55, 0, 0.5, 0.5, 'sawtooth');
}

export function playFanfare(a) {
  blip(a, 523, 0, 0.3, 0.25);
  blip(a, 659, 0.12, 0.3, 0.25);
  blip(a, 784, 0.24, 0.5, 0.28);
}

export function setMuted(a, muted) {
  a.muted = muted;
  if (a.master) a.master.gain.value = muted ? 0 : 0.5;
}
