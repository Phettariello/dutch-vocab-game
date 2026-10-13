import React, { useState } from "react";
import { supabase } from "../supabaseClient";

function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const styles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
      padding: "20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
    },
    card: {
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "12px",
      padding: "clamp(24px, 6vw, 40px)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      maxWidth: "420px",
      width: "100%",
      boxSizing: "border-box",
    },
    title: { fontSize: "clamp(24px, 6vw, 32px)", fontWeight: 800, margin: "0 0 12px", color: "white", textAlign: "center" },
    subtitle: { fontSize: "14px", color: "#06b6d4", margin: "0 0 24px", textAlign: "center", fontWeight: 600 },
    text: { color: "#dbeafe", fontSize: "14px", lineHeight: 1.5, marginBottom: "18px", textAlign: "center" },
    input: { width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: "16px", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "8px", background: "rgba(255,255,255,0.95)", color: "#0f172a", marginBottom: "16px" },
    button: { width: "100%", padding: "12px 24px", fontSize: "14px", fontWeight: 700, background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)", color: "white", border: 0, borderRadius: "8px", cursor: "pointer", marginTop: "4px" },
    link: { display: "block", margin: "20px auto 0", background: "none", border: 0, color: "#06b6d4", cursor: "pointer", textDecoration: "underline", font: "inherit", fontWeight: 600 },
    error: { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "12px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" },
    success: { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#bbf7d0", padding: "12px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" },
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/?resetPassword=true`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (resetError) throw resetError;
      setMessage("If an account exists for this email, a password reset link will be sent. Please check your inbox.");
    } catch (err) {
      setError(err.message || "Could not send the reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.container}>
      <section style={styles.card}>
        <h1 style={styles.title}>🎮 Vocabulist</h1>
        <p style={styles.subtitle}>Reset your password</p>
        <p style={styles.text}>Enter the email address associated with your account and we'll send you a reset link.</p>
        {error && <div role="alert" style={styles.error}>❌ {error}</div>}
        {message && <div role="status" style={styles.success}>✅ {message}</div>}
        <form onSubmit={handleSubmit}>
          <label htmlFor="reset-email" style={{ display: "block", color: "#bfdbfe", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Email</label>
          <input id="reset-email" type="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} required />
          <button type="submit" disabled={loading} style={{ ...styles.button, opacity: loading ? 0.65 : 1 }}>{loading ? "Sending link..." : "Send reset link"}</button>
        </form>
        <button type="button" onClick={onBack} style={styles.link}>← Back to sign up</button>
      </section>
    </main>
  );
}

export default ForgotPassword;
