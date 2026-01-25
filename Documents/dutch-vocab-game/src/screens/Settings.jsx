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
    parseFloat(localStorage.getItem("volume")) || 70
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

  // Salva impostazioni audio su localStorage
  useEffect(() => {
    localStorage.setItem("soundEnabled", soundEnabled);
    localStorage.setItem("volume", volume);
  }, [soundEnabled, volume]);

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
    localStorage.removeItem("soundEnabled");
    localStorage.removeItem("volume");
    localStorage.clear();
    setMessage("✅ Cache cleared! Refresh the page.");
    setTimeout(() => setMessage(""), 3000);
  };

  const styles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
      padding: "20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "40px",
      position: "sticky",
      top: 0,
      zIndex: 100,
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
      padding: "20px 0",
    },
    title: {
      fontSize: "36px",
      fontWeight: "800",
      margin: 0,
      color: "white",
      textShadow: "0 2px 10px rgba(6,182,212,0.4)",
    },
    backButton: {
      padding: "12px 24px",
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
      padding: "24px",
      marginBottom: "20px",
      color: "white",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
    },
    sectionTitle: {
      fontSize: "20px",
      fontWeight: "700",
      margin: "0 0 16px 0",
      color: "#fbbf24",
      textTransform: "uppercase",
      letterSpacing: "1px",
    },
    settingItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 0",
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
      fontSize: "20px",
      fontWeight: "700",
      margin: "0 0 16px 0",
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
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>⚙️ SETTINGS</h1>
        <button
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

      <div style={styles.contentContainer}>
        {message && <div style={styles.message}>{message}</div>}

        {/* ACCOUNT SETTINGS */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>👤 Account</h2>

          <div style={styles.settingItem}>
            <div>
              <div style={styles.settingLabel}>Username</div>
              <div style={{ fontSize: "12px", color: "#bfdbfe", marginTop: "4px" }}>
                {username || "Loading..."}
              </div>
            </div>
            {!isEditingUsername ? (
              <button
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                }}
                onClick={() => setIsEditingUsername(true)}
              >
                Edit
              </button>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
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

          <div style={styles.settingItem}>
            <div>
              <div style={styles.settingLabel}>Email</div>
              <div style={{ fontSize: "12px", color: "#bfdbfe", marginTop: "4px" }}>
                {user?.email || "Loading..."}
              </div>
            </div>
            <span style={{ fontSize: "12px", color: "#999" }}>Read-only</span>
          </div>

          <div style={styles.settingItem}>
            <div style={styles.settingLabel}>Change Password</div>
            <button
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
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🔊 Audio</h2>

          <div style={styles.settingItem}>
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

          <div style={styles.settingItem}>
            <div style={styles.settingLabel}>Volume: {volume}%</div>
          </div>

          <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(6,182,212,0.1)" }}>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={styles.slider}
              disabled={!soundEnabled}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", padding: "12px 0" }}>
            <button
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
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>💾 Data</h2>

          <div style={styles.settingItem}>
            <div style={styles.settingLabel}>Reset All Progress</div>
            <button
              style={{
                ...styles.button,
                ...styles.buttonDanger,
              }}
              onClick={() => setShowResetModal(true)}
            >
              Reset
            </button>
          </div>

          <div style={styles.settingItem}>
            <div style={styles.settingLabel}>Clear Cache</div>
            <button
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
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>ℹ️ About</h2>

          <div style={styles.settingItem}>
            <div>
              <div style={styles.settingLabel}>App Version</div>
              <div style={{ fontSize: "12px", color: "#bfdbfe", marginTop: "4px" }}>
                1.0.0
              </div>
            </div>
          </div>

          <div style={styles.settingItem}>
            <div>
              <div style={styles.settingLabel}>Privacy Policy</div>
            </div>
            <a
              href="/privacy"
              style={{
                color: "#06b6d4",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              Read →
            </a>
          </div>

          <div style={styles.settingItem}>
            <div>
              <div style={styles.settingLabel}>Terms of Service</div>
            </div>
            <a
              href="/terms"
              style={{
                color: "#06b6d4",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              Read →
            </a>
          </div>
        </div>
      </div>

      {/* PASSWORD CHANGE MODAL */}
      {showPasswordModal && (
        <div style={styles.modal} onClick={() => setShowPasswordModal(false)}>
          <div
            style={styles.modalContent}
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

            <div style={styles.modalButtons}>
              <button
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
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={styles.modalTitle}>⚠️ Reset All Progress?</h3>
            <p style={styles.modalText}>
              This will delete all your game progress, scores, and statistics.
              <strong> This action cannot be undone!</strong>
            </p>

            <div style={styles.modalButtons}>
              <button
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
