import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Settings({ goBack }) {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(
    localStorage.getItem("soundEnabled") !== "false"
  );
  const [volume, setVolume] = useState(
    Number(localStorage.getItem("volume") ?? 70)
  );
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(
    localStorage.getItem("backgroundMusicEnabled") !== "false"
  );
  const [musicVolume, setMusicVolume] = useState(
    Number(localStorage.getItem("backgroundMusicVolume") ?? 20)
  );
  const [showResetModal, setShowResetModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        setUser(userData.user);
        // Fetch username
        const { data: profileData } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", userData.user.id)
          .single();
        if (profileData) {
          setUsername(profileData.username);
        }
      }
    };
    getUser();
  }, []);

  // Persist audio preferences independently and notify the persistent music player.
  useEffect(() => {
    localStorage.setItem("soundEnabled", String(soundEnabled));
    localStorage.setItem("volume", String(volume));
  }, [soundEnabled, volume]);

  useEffect(() => {
    localStorage.setItem("backgroundMusicEnabled", String(backgroundMusicEnabled));
    localStorage.setItem("backgroundMusicVolume", String(musicVolume));
    window.dispatchEvent(new CustomEvent("background-music-setting-changed", {
      detail: { enabled: backgroundMusicEnabled, volume: musicVolume / 100 }
    }));
    // Update the currently mounted background player immediately, even if its src is absolute.
    document.querySelectorAll("audio").forEach((audio) => {
      const source = audio.currentSrc || audio.src || "";
      if (source.includes("background-music.mp3") || source.includes("background-classical.wav")) {
        audio.volume = musicVolume / 100;
        audio.muted = !backgroundMusicEnabled;
        if (backgroundMusicEnabled && audio.paused) {
          const playPromise = audio.play();
          if (playPromise && typeof playPromise.catch === "function") playPromise.catch(() => {});
        }
      }
    });
  }, [backgroundMusicEnabled, musicVolume]);

  const playTestSound = (type) => {
    if (!soundEnabled) {
      alert("Sound is disabled!");
      return;
    }

    // Crea un suono semplice con Web Audio API
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Imposta volume
    gainNode.gain.value = volume / 100;

    if (type === "correct") {
      // Suono positivo: DO-MI-SOL (C-E-G)
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
    } else {
      // Suono negativo: nota bassa scendente
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.2);
      gainNode.gain.setValueAtTime(volume / 100, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.3);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  };

  const handleUpdateUsername = async () => {
    if (!username.trim()) {
      setMessage("Username cannot be empty");
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username: username.trim() })
        .eq("user_id", user.id);

      if (error) throw error;
      setMessage("✅ Username updated successfully!");
      setIsEditingUsername(false);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("❌ Error updating username: " + error.message);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setMessage("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      setMessage("✅ Password changed successfully!");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordModal(false);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("❌ Error changing password: " + error.message);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleResetProgress = async () => {
    try {
      const { error } = await supabase
        .from("user_progress")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
      setMessage("✅ All progress reset!");
      setShowResetModal(false);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("❌ Error resetting progress: " + error.message);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleClearCache = () => {
    // Do not use localStorage.clear(): it can remove login and app preferences.
    setMessage("Cache clearing is managed by your browser. Your settings were kept.");
    setTimeout(() => setMessage(""), 4000);
  };

  const styles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
      padding: "12px 16px 32px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      margin: "0 -2px 16px",
      position: "sticky",
      top: 0,
      zIndex: 100,
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
      padding: "max(8px, env(safe-area-inset-top)) 0 10px",
      minHeight: "48px",
      boxSizing: "border-box",
      borderBottom: "1px solid rgba(191,219,254,0.12)",
      backdropFilter: "blur(14px)",
    },
    title: {
      fontSize: "clamp(20px, 5vw, 26px)",
      fontWeight: "800",
      margin: 0,
      color: "white",
      textShadow: "0 2px 10px rgba(6,182,212,0.4)",
    },
    backButton: {
      padding: "10px 13px",
      minHeight: "42px",
      whiteSpace: "nowrap",
      backgroundColor: "#06b6d4",
      color: "#0f172a",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
      transition: "all 0.3s ease",
    },
    contentContainer: {
      maxWidth: "900px",
      margin: "0 auto",
    },
    section: {
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "12px",
      padding: "16px",
      marginBottom: "14px",
      color: "white",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
    },
    sectionTitle: {
      fontSize: "16px",
      fontWeight: "700",
      margin: "0 0 10px 0",
      color: "#fbbf24",
      textTransform: "uppercase",
      letterSpacing: "1px",
    },
    settingItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 0",
      gap: "12px",
      minWidth: 0,
      borderBottom: "1px solid rgba(6,182,212,0.1)",
    },
    settingLabel: {
      fontSize: "14px",
      fontWeight: "600",
      color: "#bfdbfe",
    },
    input: {
      padding: "10px 12px",
      borderRadius: "8px",
      border: "1px solid rgba(6,182,212,0.3)",
      background: "rgba(30, 58, 138, 0.8)",
      color: "white",
      fontSize: "14px",
      fontFamily: "inherit",
      transition: "all 0.3s ease",
    },
    button: {
      padding: "10px 20px",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "600",
      transition: "all 0.3s ease",
      textTransform: "uppercase",
    },
    buttonPrimary: {
      backgroundColor: "#06b6d4",
      color: "#0f172a",
    },
    buttonDanger: {
      backgroundColor: "#ef4444",
      color: "white",
    },
    buttonSecondary: {
      backgroundColor: "rgba(6,182,212,0.2)",
      color: "#06b6d4",
      border: "1px solid rgba(6,182,212,0.5)",
    },
    slider: {
      width: "100%",
      height: "6px",
      borderRadius: "3px",
      background: "rgba(6,182,212,0.3)",
      outline: "none",
      WebkitAppearance: "none",
    },
    toggle: {
      width: "50px",
      height: "26px",
      borderRadius: "13px",
      border: "none",
      background: soundEnabled ? "#06b6d4" : "#666",
      cursor: "pointer",
      transition: "all 0.3s ease",
      position: "relative",
    },
    toggleInner: {
      position: "absolute",
      width: "22px",
      height: "22px",
      borderRadius: "50%",
      background: "white",
      top: "2px",
      left: soundEnabled ? "26px" : "2px",
      transition: "left 0.3s ease",
    },
    message: {
      padding: "12px 16px",
      borderRadius: "8px",
      marginBottom: "16px",
      fontSize: "14px",
      fontWeight: "600",
      background: message.includes("❌")
        ? "rgba(239, 68, 68, 0.2)"
        : "rgba(34, 197, 94, 0.2)",
      color: message.includes("❌") ? "#ff6b6b" : "#22c55e",
      border: `1px solid ${
        message.includes("❌")
          ? "rgba(239, 68, 68, 0.5)"
          : "rgba(34, 197, 94, 0.5)"
      }`,
    },
    modal: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    },
    modalContent: {
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      border: "1px solid rgba(6,182,212,0.3)",
      borderRadius: "12px",
      padding: "32px",
      maxWidth: "400px",
      color: "white",
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    },
    modalTitle: {
      fontSize: "16px",
      fontWeight: "700",
      margin: "0 0 10px 0",
      color: "#fbbf24",
    },
    modalText: {
      fontSize: "14px",
      color: "#bfdbfe",
      margin: "0 0 24px 0",
      lineHeight: "1.6",
    },
    modalButtons: {
      display: "flex",
      gap: "12px",
    },
    readOnlyField: {
      padding: "10px 12px",
      borderRadius: "8px",
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(6,182,212,0.2)",
      color: "#bfdbfe",
      fontSize: "14px",
    },
  };

  return (
    <div style={styles.container} className="settings-page">
      <style>{`
        * { box-sizing: border-box; }
        .settings-user-row { display:flex; align-items:center; justify-content:space-between; gap:12px; min-width:0; }
        .settings-account-description { color:#bfdbfe; font-size:13px; line-height:1.5; margin:-4px 0 14px; }
        .settings-account-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:14px; }
        .settings-account-username { display:flex; align-items:baseline; flex-wrap:wrap; gap:8px 12px; flex:1; min-width:0; }
        .settings-account-username .settings-setting-label { flex:0 0 auto; }
        .settings-user-name { min-width:0; color:#fff !important; font-size:14px; font-weight:600; overflow-wrap:anywhere; }
        .settings-account-value { min-width:0; color:#fff; font-size:13px; line-height:1.45; overflow-wrap:anywhere; }
        .settings-account-note { color:#bfdbfe; font-size:11px; white-space:nowrap; }
        .settings-volume-heading { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:4px; }
        .settings-volume-heading strong { color:#fff; font-size:13px; font-variant-numeric:tabular-nums; }
        .settings-range { display:block; width:100%; height:32px; min-height:32px; margin:0; padding:0; accent-color:#06b6d4; touch-action:pan-y; cursor:pointer; }
        .settings-username-editor { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
        .settings-username-editor input { min-width:0; width: min(100%, 180px); }
        .settings-range { width:100%; min-height:32px; accent-color:#06b6d4; touch-action:pan-y; }
        .settings-modal-content { width:min(100% - 28px, 400px); max-height:calc(100dvh - 32px); overflow-y:auto; }
        @media (max-width: 480px) {
          .settings-page { padding-left:12px !important; padding-right:12px !important; }
          .settings-header { gap:8px; }
          .settings-back { padding:9px 10px !important; font-size:12px !important; }
          .settings-content { width:100%; }
          .settings-section { padding:14px !important; border-radius:14px !important; }
          .settings-setting-row { align-items:center; }
          .settings-account-row { gap:8px; }
          .settings-account-username { gap:5px 8px; }
          .settings-account-username .settings-setting-label { font-size:12px !important; }
          .settings-user-name { font-size:13px !important; white-space:normal; overflow-wrap:anywhere; }
          .settings-account-value { font-size:12px; }
          .settings-account-note { font-size:10px; }
          .settings-setting-label { font-size:13px !important; }
          .settings-action { padding:10px 12px !important; min-height:42px; }
          .settings-modal-buttons { flex-wrap:wrap; }
        }
      `}</style>
      <div style={styles.header} className="settings-header">
        <h1 style={styles.title}>⚙️ SETTINGS</h1>
        <button
          className="settings-back"
          style={styles.backButton}
          onClick={goBack}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#0891b2";
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#06b6d4";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          ← Back to Menu
        </button>
      </div>

      <div style={styles.contentContainer} className="settings-content">
        {message && <div style={styles.message}>{message}</div>}

        {/* ACCOUNT SETTINGS */}
        <div style={styles.section} className="settings-section">
          <h2 style={styles.sectionTitle}>👤 Account</h2>
          <p className="settings-account-description">Manage your profile details and account security.</p>

          <div style={styles.settingItem} className="settings-setting-row settings-account-row">
            <div className="settings-account-username">
              <div className="settings-setting-label" style={styles.settingLabel}>Username</div>
              <div className="settings-user-name" style={{ fontSize: "14px", color: "#bfdbfe" }}>
                {username || "Loading..."}
              </div>
            </div>
            {!isEditingUsername ? (
              <button
                className="settings-action"
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                }}
                onClick={() => setIsEditingUsername(true)}
              >
                Edit
              </button>
            ) : (
              <div className="settings-username-editor" style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  style={styles.input}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="New username"
                />
                <button
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
                  }}
                  onClick={handleUpdateUsername}
                >
                  Save
                </button>
                <button
                  style={{
                    ...styles.button,
                    ...styles.buttonSecondary,
                  }}
                  onClick={() => setIsEditingUsername(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div style={styles.settingItem} className="settings-setting-row settings-account-row">
            <div style={{ minWidth: 0 }}>
              <div style={styles.settingLabel}>Email</div>
              <div className="settings-account-value" style={{ marginTop: "4px" }}>
                {user?.email || "Loading..."}
              </div>
            </div>
            <span className="settings-account-note">Read-only</span>
          </div>

          <div style={styles.settingItem} className="settings-setting-row settings-account-row">
            <div style={styles.settingLabel}>Change Password</div>
            <button
              className="settings-action"
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
              }}
              onClick={() => setShowPasswordModal(true)}
            >
              Change
            </button>
          </div>
        </div>

        {/* AUDIO SETTINGS */}
        <div style={styles.section} className="settings-section">
          <h2 style={styles.sectionTitle}>🔊 Audio</h2>

          <div style={styles.settingItem} className="settings-setting-row">
            <div style={styles.settingLabel}>Background Music</div>
            <button
              type="button"
              role="switch"
              aria-checked={backgroundMusicEnabled}
              aria-label="Background music"
              style={{ ...styles.toggle, background: backgroundMusicEnabled ? "#06b6d4" : "#666" }}
              onClick={() => setBackgroundMusicEnabled(v => !v)}
            >
              <div style={{ ...styles.toggleInner, left: backgroundMusicEnabled ? "26px" : "2px" }} />
            </button>
          </div>
          <div style={{ padding: "8px 0 12px", borderBottom: "1px solid rgba(6,182,212,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={styles.settingLabel}>Music volume</span>
              <strong style={{ color: "#fff", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{musicVolume}%</strong>
            </div>
            <input className="settings-range" aria-label="Music volume" type="range" min="0" max="100" step="1" value={musicVolume} disabled={!backgroundMusicEnabled} onChange={e => setMusicVolume(Number(e.target.value))} />
          </div>

          <div style={styles.settingItem} className="settings-setting-row">
            <div style={styles.settingLabel}>Sound Effects</div>
            <button
              style={{
                ...styles.toggle,
                background: soundEnabled ? "#06b6d4" : "#666",
              }}
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              <div style={styles.toggleInner} />
            </button>
          </div>

          <div style={{ padding: "8px 0 12px", borderBottom: "1px solid rgba(6,182,212,0.1)" }}>
            <div className="settings-volume-heading">
              <span style={styles.settingLabel}>Sound effects volume</span>
              <strong>{volume}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="settings-range"
              aria-label="Sound effects volume"
              disabled={!soundEnabled}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", padding: "12px 0" }}>
            <button
              className="settings-action"
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
                flex: 1,
              }}
              onClick={() => playTestSound("correct")}
            >
              ✅ Test Correct
            </button>
            <button
              className="settings-action"
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
                flex: 1,
              }}
              onClick={() => playTestSound("wrong")}
            >
              ❌ Test Wrong
            </button>
          </div>
        </div>

        {/* DATA SETTINGS */}
        <div style={styles.section} className="settings-section">
          <h2 style={styles.sectionTitle}>💾 Data</h2>

          <div style={styles.settingItem} className="settings-setting-row">
            <div style={styles.settingLabel}>Reset All Progress</div>
            <button
              className="settings-action"
              style={{
                ...styles.button,
                ...styles.buttonDanger,
              }}
              onClick={() => setShowResetModal(true)}
            >
              Reset
            </button>
          </div>

          <div style={styles.settingItem} className="settings-setting-row">
            <div style={styles.settingLabel}>Clear Cache</div>
            <button
              className="settings-action"
              style={{
                ...styles.button,
                ...styles.buttonDanger,
              }}
              onClick={handleClearCache}
            >
              Clear
            </button>
          </div>
        </div>

        {/* ABOUT SECTION */}
        <div style={styles.section} className="settings-section">
          <h2 style={styles.sectionTitle}>ℹ️ About Vocabulist</h2>
          <p style={{ color: "#bfdbfe", fontSize: "14px", lineHeight: 1.6, margin: "0 0 16px" }}>
            Vocabulist helps you build your Dutch vocabulary through short, repeatable practice sessions.
          </p>

          <div style={styles.settingItem} className="settings-setting-row">
            <div>
              <div style={styles.settingLabel}>🎮 Play</div>
              <div style={{ color: "#bfdbfe", fontSize: "13px", lineHeight: 1.5, marginTop: "4px" }}>
                Test your recall with English-to-Dutch questions and build your progress level by level.
              </div>
            </div>
          </div>
          <div style={styles.settingItem} className="settings-setting-row">
            <div>
              <div style={styles.settingLabel}>📝 Review Mode</div>
              <div style={{ color: "#bfdbfe", fontSize: "13px", lineHeight: 1.5, marginTop: "4px" }}>
                Revisit words you missed so you can strengthen your memory.
              </div>
            </div>
          </div>
          <div style={styles.settingItem} className="settings-setting-row">
            <div>
              <div style={styles.settingLabel}>📚 Practice Mode</div>
              <div style={{ color: "#bfdbfe", fontSize: "13px", lineHeight: 1.5, marginTop: "4px" }}>
                Practise vocabulary at your own pace, without the pressure of a timed test.
              </div>
            </div>
          </div>
          <div style={styles.settingItem} className="settings-setting-row">
            <div>
              <div style={styles.settingLabel}>📖 Your Words &amp; Achievements</div>
              <div style={{ color: "#bfdbfe", fontSize: "13px", lineHeight: 1.5, marginTop: "4px" }}>
                Keep track of vocabulary and see the progress you have made.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PASSWORD CHANGE MODAL */}
      {showPasswordModal && (
        <div style={styles.modal} onClick={() => setShowPasswordModal(false)}>
          <div
            style={styles.modalContent}
            className="settings-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={styles.modalTitle}>Change Password</h3>
            <p style={styles.modalText}>
              Enter your new password (minimum 6 characters)
            </p>

            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ ...styles.input, width: "100%", marginBottom: "12px" }}
            />

            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ ...styles.input, width: "100%", marginBottom: "24px" }}
            />

            <div style={styles.modalButtons} className="settings-modal-buttons">
              <button
                className="settings-action"
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  flex: 1,
                }}
                onClick={handleChangePassword}
              >
                Change
              </button>
              <button
                className="settings-action"
                style={{
                  ...styles.button,
                  ...styles.buttonSecondary,
                  flex: 1,
                }}
                onClick={() => setShowPasswordModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET PROGRESS MODAL */}
      {showResetModal && (
        <div style={styles.modal} onClick={() => setShowResetModal(false)}>
          <div
            style={styles.modalContent}
            className="settings-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={styles.modalTitle}>⚠️ Reset All Progress?</h3>
            <p style={styles.modalText}>
              This will delete all your game progress, scores, and statistics.
              <strong> This action cannot be undone!</strong>
            </p>

            <div style={styles.modalButtons} className="settings-modal-buttons">
              <button
                className="settings-action"
                style={{
                  ...styles.button,
                  ...styles.buttonDanger,
                  flex: 1,
                }}
                onClick={handleResetProgress}
              >
                Reset
              </button>
              <button
                className="settings-action"
                style={{
                  ...styles.button,
                  ...styles.buttonSecondary,
                  flex: 1,
                }}
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
