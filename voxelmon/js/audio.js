/** Efectos de sonido sintetizados con WebAudio (sin ficheros) */

let ctx = null;
let muted = false;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, { type = "square", vol = 0.12, slide = 0, delay = 0 } = {}) {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, { vol = 0.1, freq = 800, delay = 0 } = {}) {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = freq;
  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t0);
}

export const sfx = {
  select: () => tone(660, 0.07, { type: "square", vol: 0.07 }),
  break: () => noise(0.14, { vol: 0.16, freq: 900 }),
  place: () => tone(220, 0.08, { type: "triangle", vol: 0.14, slide: -60 }),
  step: () => noise(0.05, { vol: 0.03, freq: 500 }),
  battleStart: () => {
    tone(330, 0.12, { vol: 0.12 });
    tone(415, 0.12, { delay: 0.12, vol: 0.12 });
    tone(494, 0.2, { delay: 0.24, vol: 0.14 });
  },
  hit: () => { tone(180, 0.12, { type: "sawtooth", vol: 0.14, slide: -80 }); noise(0.08, { vol: 0.08 }); },
  superHit: () => { tone(120, 0.2, { type: "sawtooth", vol: 0.2, slide: -60 }); noise(0.16, { vol: 0.14, freq: 1400 }); },
  weakHit: () => tone(300, 0.07, { type: "triangle", vol: 0.07 }),
  faint: () => tone(300, 0.5, { type: "sawtooth", vol: 0.12, slide: -240 }),
  throw: () => tone(500, 0.18, { type: "triangle", vol: 0.1, slide: 300 }),
  bounce: () => tone(340, 0.08, { type: "square", vol: 0.08, slide: -40 }),
  catch: () => {
    tone(523, 0.1, { vol: 0.12 });
    tone(659, 0.1, { delay: 0.11, vol: 0.12 });
    tone(784, 0.1, { delay: 0.22, vol: 0.12 });
    tone(1047, 0.3, { delay: 0.33, vol: 0.14 });
  },
  escape: () => { noise(0.2, { vol: 0.1, freq: 600 }); tone(200, 0.2, { type: "triangle", vol: 0.08, slide: 150 }); },
  levelUp: () => {
    tone(587, 0.09, { vol: 0.1 });
    tone(740, 0.09, { delay: 0.09, vol: 0.1 });
    tone(880, 0.18, { delay: 0.18, vol: 0.12 });
  },
  evolve: () => {
    for (let i = 0; i < 6; i++) tone(392 + i * 98, 0.12, { delay: i * 0.1, vol: 0.1, type: "triangle" });
    tone(1175, 0.5, { delay: 0.62, vol: 0.13 });
  },
  legendary: () => {
    for (let i = 0; i < 4; i++) tone(196 + i * 65, 0.4, { delay: i * 0.2, vol: 0.12, type: "sawtooth" });
    tone(784, 0.8, { delay: 0.9, vol: 0.14, type: "triangle" });
  },
  heal: () => { tone(523, 0.12, { type: "triangle", vol: 0.1 }); tone(784, 0.2, { delay: 0.12, type: "triangle", vol: 0.1 }); },
};
