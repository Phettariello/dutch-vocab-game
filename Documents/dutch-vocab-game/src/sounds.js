// src/sounds.js
// Small sound effects built with the Web Audio API (no sound files needed).
// Respects the "Sound Effects" settings (soundEnabled / volume in localStorage).

let ctx = null;

function getCtx() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Call this inside a tap (e.g. a "Start" button) so iPhone allows sound later on.
export function unlockAudio() {
  try {
    getCtx();
  } catch (e) {
    // sound is optional
  }
}

// Small vibration (Android only; iPhone Safari ignores it). Follows the sound setting.
export function buzz(pattern) {
  try {
    if (localStorage.getItem("soundEnabled") !== "false") navigator.vibrate?.(pattern);
  } catch (e) {
    // vibration is optional
  }
}

function celebration(c, volume) {
  const master = c.createGain();
  master.gain.value = (volume / 100) * 0.5;
  master.connect(c.destination);

  const tone = (freq, start, duration, type = "triangle", level = 1) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t0 = c.currentTime + start;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(level, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  };

  tone(523.25, 0.0, 0.16);
  tone(659.25, 0.13, 0.16);
  tone(783.99, 0.26, 0.16);
  tone(1046.5, 0.39, 0.3);
  tone(783.99, 0.78, 0.14);
  tone(1046.5, 0.9, 0.14);
  tone(1046.5, 1.05, 1.0);
  tone(1318.5, 1.05, 1.0);
  tone(1568.0, 1.05, 1.0);
  tone(2093.0, 1.05, 0.6, "square", 0.12);
}

// Extra sound effects. Each note: [frequency, start, duration, waveform, level]
const SOUNDS = {
  newword: [
    [880, 0, 0.12, "sine", 0.9],
    [1108.7, 0.1, 0.12, "sine", 0.9],
    [1318.5, 0.2, 0.12, "sine", 0.9],
    [1760, 0.3, 0.4, "sine", 1],
    [2217.5, 0.4, 0.5, "sine", 0.3],
    [2637, 0.5, 0.5, "sine", 0.2],
  ],
  streak: [
    [659.25, 0, 0.1],
    [783.99, 0.08, 0.1],
    [987.77, 0.16, 0.1],
    [1318.5, 0.24, 0.3],
  ],
  lifegain: [
    [783.99, 0, 0.12, "sine"],
    [1046.5, 0.1, 0.12, "sine"],
    [1568, 0.2, 0.35, "sine"],
  ],
  gameover: [
    [392, 0, 0.3],
    [349.23, 0.28, 0.3],
    [329.63, 0.56, 0.3],
    [261.63, 0.84, 0.8],
  ],
  milestone: [
    [523.25, 0, 0.14], [659.25, 0.12, 0.14], [783.99, 0.24, 0.14],
    [1046.5, 0.36, 0.14], [1318.5, 0.48, 0.14], [1568, 0.6, 0.2],
    [523.25, 0.85, 1.3], [659.25, 0.85, 1.3], [783.99, 0.85, 1.3],
    [1046.5, 0.85, 1.3], [1568, 0.85, 1.3, "sine", 0.6],
    [2093, 0.95, 0.4, "sine", 0.3], [2637, 1.1, 0.4, "sine", 0.25], [3136, 1.25, 0.5, "sine", 0.2],
  ],
  pop: [
    [520, 0, 0.07, "sine", 0.8],
    [780, 0.05, 0.09, "sine", 0.6],
  ],
};

function playTones(c, volume, notes) {
  const master = c.createGain();
  master.gain.value = (volume / 100) * 0.5;
  master.connect(c.destination);
  notes.forEach(([freq, start, duration, type = "triangle", level = 1]) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t0 = c.currentTime + start;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(level, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  });
}

export function playSound(type) {
  if (localStorage.getItem("soundEnabled") === "false") return;
  const stored = parseFloat(localStorage.getItem("volume"));
  const volume = Number.isNaN(stored) ? 70 : stored;
  if (volume <= 0) return;

  try {
    const c = getCtx();
    if (SOUNDS[type]) {
      playTones(c, volume, SOUNDS[type]);
      return;
    }
    if (type === "celebrate") {
      celebration(c, volume);
      return;
    }
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    gain.gain.value = volume / 100;

    if (type === "correct") {
      osc.frequency.setValueAtTime(523.25, c.currentTime);
      osc.frequency.setValueAtTime(659.25, c.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, c.currentTime + 0.2);
    } else {
      osc.frequency.setValueAtTime(400, c.currentTime);
      osc.frequency.setValueAtTime(300, c.currentTime + 0.1);
      osc.frequency.setValueAtTime(200, c.currentTime + 0.2);
      gain.gain.setValueAtTime(volume / 100, c.currentTime);
      gain.gain.setValueAtTime(0, c.currentTime + 0.3);
    }
    osc.start();
    osc.stop(c.currentTime + 0.4);
  } catch (e) {
    // sound is optional
  }
}
