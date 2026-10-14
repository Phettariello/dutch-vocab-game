import React, { useEffect, useMemo } from "react";

const MEDAL = {
  gold: { emoji: "🥇", label: "Gold", color: "#fbbf24" },
  silver: { emoji: "🥈", label: "Silver", color: "#e2e8f0" },
  bronze: { emoji: "🥉", label: "Bronze", color: "#fdba74" },
};
const KIND_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const KIND_ORDER = { monthly: 0, weekly: 1, daily: 2 };
const MEDAL_ORDER = { gold: 0, silver: 1, bronze: 2 };

// "2026-10-12" -> a local Date, without any timezone shift
function parseDay(value) {
  const [y, m, d] = String(value).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function periodLabel(medal) {
  if (!medal.period_start) return "";
  const start = parseDay(medal.period_start);
  if (medal.kind === "daily") {
    return start.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }
  if (medal.kind === "weekly") {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const short = { day: "numeric", month: "short" };
    return `Week of ${start.toLocaleDateString("en-GB", short)} – ${end.toLocaleDateString("en-GB", short)}`;
  }
  return start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// ---------------------------------------------------------------------
// Sound: a short "ta-da" jingle (Web Audio, no sound files needed)
// ---------------------------------------------------------------------
let medalCtx = null;

function playJingle(ctx, volume) {
  const master = ctx.createGain();
  master.gain.value = (volume / 100) * 0.45;
  master.connect(ctx.destination);

  const tone = (freq, start, duration, type = "triangle", level = 1) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + start;
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

  // Rising run
  tone(392.0, 0.0, 0.16); // G4
  tone(523.25, 0.12, 0.16); // C5
  tone(659.25, 0.24, 0.16); // E5
  tone(783.99, 0.36, 0.22); // G5
  // Big chord
  tone(523.25, 0.64, 1.1);
  tone(659.25, 0.64, 1.1);
  tone(783.99, 0.64, 1.1);
  tone(1046.5, 0.64, 1.1);
  // Sparkles
  tone(2093.0, 0.72, 0.35, "sine", 0.35);
  tone(2637.0, 0.84, 0.35, "sine", 0.3);
  tone(3136.0, 0.96, 0.45, "sine", 0.25);
}

function useMedalSound() {
  useEffect(() => {
    const enabled = localStorage.getItem("soundEnabled") !== "false";
    if (!enabled) return undefined;
    const volume = parseFloat(localStorage.getItem("volume")) || 70;
    let played = false;

    // Browsers (especially iPhone) only allow sound after a tap. So we try
    // right away, and if that is blocked we play it on the first tap.
    const tryPlay = async () => {
      if (played) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!medalCtx) medalCtx = new Ctx();
        if (medalCtx.state === "suspended") await medalCtx.resume();
        if (played) return;
        if (medalCtx.state === "running") {
          played = true;
          playJingle(medalCtx, volume);
        }
      } catch (e) {
        // sound is optional
      }
    };

    tryPlay();
    document.addEventListener("pointerdown", tryPlay);
    return () => document.removeEventListener("pointerdown", tryPlay);
  }, []);
}

export default function MedalPopup({ medals, onClose }) {
  useMedalSound();

  const sorted = useMemo(
    () =>
      [...medals].sort(
        (a, b) =>
          KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
          MEDAL_ORDER[a.medal_type] - MEDAL_ORDER[b.medal_type]
      ),
    [medals]
  );

  const confetti = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 2.4 + Math.random() * 1.8,
        size: 6 + Math.random() * 6,
        color: ["#fbbf24", "#06b6d4", "#7c3aed", "#22c55e", "#ef4444", "#3b82f6"][i % 6],
      })),
    []
  );

  const main = MEDAL[sorted[0].medal_type] || MEDAL.bronze;

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="You won a medal">
      <style>{KEYFRAMES}</style>

      <div style={styles.confettiLayer} aria-hidden="true">
        {confetti.map((p, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              top: "-20px",
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 1.6,
              background: p.color,
              borderRadius: 2,
              animation: `mp-fall ${p.duration}s ${p.delay}s ease-in forwards`,
            }}
          />
        ))}
      </div>

      <div style={styles.card}>
        <div style={{ ...styles.bigMedal, filter: `drop-shadow(0 0 18px ${main.color})` }}>
          {main.emoji}
        </div>
        <h2 style={styles.title}>
          {sorted.length > 1 ? `You won ${sorted.length} medals!` : "You won a medal!"}
        </h2>
        <p style={styles.subtitle}>Well done, champion. Here is your reward:</p>

        <div style={styles.list}>
          {sorted.map((m) => {
            const info = MEDAL[m.medal_type] || MEDAL.bronze;
            return (
              <div key={`${m.kind}-${m.id}`} style={styles.row}>
                <span style={styles.rowEmoji}>{info.emoji}</span>
                <span style={styles.rowText}>
                  <span style={{ ...styles.rowTitle, color: info.color }}>
                    {info.label} · {KIND_LABEL[m.kind]}
                  </span>
                  <span style={styles.rowSub}>{periodLabel(m)}</span>
                </span>
              </div>
            );
          })}
        </div>

        <button type="button" style={styles.button} onClick={onClose}>
          Awesome!
        </button>
      </div>
    </div>
  );
}

const KEYFRAMES = `
@keyframes mp-in { 0% { opacity: 0; transform: scale(0.85) translateY(16px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes mp-pop { 0% { transform: scale(0.2) rotate(-20deg); opacity: 0; } 60% { transform: scale(1.25) rotate(8deg); opacity: 1; } 100% { transform: scale(1) rotate(0); } }
@keyframes mp-fall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; } }
@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; } }
`;

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "rgba(2, 6, 23, 0.8)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  confettiLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    pointerEvents: "none",
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 380,
    padding: "26px 22px 22px",
    borderRadius: 24,
    border: "1px solid rgba(251, 191, 36, 0.55)",
    background: "linear-gradient(155deg, #1e3a8a 0%, #4c1d95 100%)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.55), 0 0 40px rgba(251,191,36,0.18)",
    textAlign: "center",
    color: "#fff",
    animation: "mp-in 0.45s ease-out",
  },
  bigMedal: { fontSize: 84, lineHeight: 1, animation: "mp-pop 0.8s ease-out" },
  title: { margin: "12px 0 4px", fontSize: 24, fontWeight: 850 },
  subtitle: { margin: "0 0 16px", fontSize: 14, color: "#bfdbfe" },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: "36vh",
    overflowY: "auto",
    marginBottom: 18,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.09)",
    textAlign: "left",
  },
  rowEmoji: { fontSize: 32, lineHeight: 1 },
  rowText: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: 800 },
  rowSub: { fontSize: 12, color: "#cbd5e1" },
  button: {
    width: "100%",
    padding: "13px 16px",
    border: 0,
    borderRadius: 12,
    background: "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 850,
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(249,115,22,0.35)",
  },
};
