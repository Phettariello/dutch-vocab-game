import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import AuthBrand from "./AuthBrand";
import { authStyles as s } from "./AuthStyles";

function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/?resetPassword=true`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (resetError) throw resetError;
      setMessage("If an account exists for that email, a password reset link will be sent. Please check your inbox.");
    } catch (err) {
      setError(err.message || "Could not send the reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={s.page}>
      <section style={s.card}>
        <AuthBrand />
        <p style={s.eyebrow}>ACCOUNT RECOVERY</p>
        <h1 style={s.title}>Forgot your password?</h1>
        <p style={s.description}>Enter the email address linked to your account and we’ll send you a secure reset link.</p>
        {error && <div role="alert" style={{ ...s.message, ...s.error }}>{error}</div>}
        {message && <div role="status" style={{ ...s.message, ...s.success }}>{message}</div>}
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.group}>
            <label htmlFor="reset-email" style={s.label}>Email address</label>
            <input id="reset-email" type="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} style={s.input} required />
          </div>
          <button type="submit" disabled={loading} style={{ ...s.button, ...(loading ? s.disabledButton : {}) }}>{loading ? "Sending reset link…" : "Email me a reset link"}</button>
        </form>
        <div style={s.footer}>
          Remembered your password? <button type="button" onClick={onBack} style={s.linkButton}>Back to Sign In</button>
        </div>
      </section>
    </main>
  );
}

export default ForgotPassword;
