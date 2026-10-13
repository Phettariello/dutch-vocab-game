import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import Login from "./Login";
import AuthBrand from "./AuthBrand";
import { authStyles as s } from "./AuthStyles";

function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) return setError("Your username must be at least 3 characters.");
    if (cleanUsername.length > 24) return setError("Your username must be 24 characters or fewer.");
    if (!/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) return setError("Use only letters, numbers, dots, hyphens, or underscores in your username.");
    if (password.length < 6) return setError("Your password must be at least 6 characters.");
    if (password !== confirmPassword) return setError("The passwords do not match.");

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (signUpError) throw signUpError;
      const user = data.user;
      if (user) {
        const { error: profileError } = await supabase.from("profiles").insert({
          user_id: user.id,
          email: user.email,
          username: cleanUsername,
        });
        if (profileError) {
          console.error("Error saving profile:", profileError);
          if (profileError.code === "23505") {
            setError("That username is already in use. Your account was created, but the username could not be saved. Please contact support to finish setting up the account.");
          } else {
            setError("Your account was created, but we couldn't save your username. Please contact support before signing in with it.");
          }
          setLoading(false);
          return;
        }
      }
      setSuccess(true);
      setEmail(""); setPassword(""); setConfirmPassword(""); setUsername("");
      window.setTimeout(() => setShowLogin(true), 1800);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (showLogin) return <Login />;

  return (
    <main style={s.page}>
      <section style={s.card}>
        <AuthBrand />
        <p style={s.eyebrow}>NEW ACCOUNT</p>
        <h1 style={s.title}>Create your account</h1>
        <p style={s.description}>Register once to save your progress and practise whenever you like.</p>

        {error && <div role="alert" style={{ ...s.message, ...s.error }}>{error}</div>}
        {success && <div role="status" style={{ ...s.message, ...s.success }}>Registration complete! Taking you to Sign In…</div>}

        <form onSubmit={handleSignUp} style={s.form}>
          <div style={s.group}>
            <label htmlFor="signup-username" style={s.label}>Username</label>
            <input id="signup-username" type="text" autoComplete="username" minLength={3} maxLength={24} placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} style={s.input} required />
            <span style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.4 }}>3–24 characters; letters, numbers, dots, hyphens, and underscores.</span>
          </div>
          <div style={s.group}>
            <label htmlFor="signup-email" style={s.label}>Email address</label>
            <input id="signup-email" type="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} style={s.input} required />
          </div>
          <div style={s.group}>
            <label htmlFor="signup-password" style={s.label}>Password</label>
            <div style={s.passwordWrap}>
              <input id="signup-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={6} placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...s.input, paddingRight: 52 }} required />
              <button type="button" onClick={() => setShowPassword(v => !v)} style={s.eyeButton} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 002.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1.1-1.2 2.3-2.3 3.4M6.2 6.2C3.9 7.7 2.8 10 2.5 12c.6 1.7 2.4 4.4 5.8 5.7 1.1.4 2.3.7 3.7.7"/></svg> : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg>}</button>
            </div>
          </div>
          <div style={s.group}>
            <label htmlFor="signup-confirm-password" style={s.label}>Confirm password</label>
            <div style={s.passwordWrap}>
              <input id="signup-confirm-password" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" minLength={6} placeholder="Enter your password again" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ ...s.input, paddingRight: 52 }} required />
              <button type="button" onClick={() => setShowConfirmPassword(v => !v)} style={s.eyeButton} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>{showConfirmPassword ? "Hide" : "Show"}</button>
            </div>
          </div>
          <button type="submit" disabled={loading || success} style={{ ...s.button, ...(loading || success ? s.disabledButton : {}) }}>{loading ? "Creating account…" : "Create Account"}</button>
        </form>

        <div style={s.footer}>
          Already registered? <button type="button" onClick={() => setShowLogin(true)} style={s.linkButton}>Sign In to your account</button>
        </div>
      </section>
    </main>
  );
}

export default SignUp;
