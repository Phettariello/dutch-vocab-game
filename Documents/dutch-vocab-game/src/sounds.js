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

export function playSound(type) {
  if (localStorage.getItem("soundEnabled") === "false") return;
  const stored = parseFloat(localStorage.getItem("volume"));
  const volume = Number.isNaN(stored) ? 70 : stored;

  try {
    const c = getCtx();
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
