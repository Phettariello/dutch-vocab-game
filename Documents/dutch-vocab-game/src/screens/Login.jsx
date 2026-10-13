import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Home from "./Home";
import SignUp from "./SignUp";
import ForgotPassword from "./ForgotPassword";
import AuthBrand from "./AuthBrand";
import { authStyles as s } from "./AuthStyles";

function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isRecovery, setIsRecovery] = useState(
    window.location.search.includes("resetPassword=true") ||
    window.location.hash.includes("type=recovery")
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");

  useEffect(() => {
    let active = true;
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (active && data?.session) setSession(data.session);
    };
    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setError("");
      }
      setSession(nextSession);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const value = identifier.trim();

    try {
      if (value.includes("@")) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: value, password });
        if (signInError) throw signInError;
        if (data?.session) setSession(data.session);
      } else {
        const { data, error: functionError } = await supabase.functions.invoke("login-with-username", {
          body: { username: value, password },
        });
        if (functionError) throw new Error("Username sign-in is not configured yet. Please try your email or contact support.");
        if (data?.error) throw new Error(data.error);
        if (!data?.session?.access_token || !data?.session?.refresh_token) {
          throw new Error("Could not sign in with that username and password. Check your details and try again.");
        }
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession(data.session);
        if (sessionError) throw sessionError;
        setSession(sessionData.session);
      }

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (user) {
        const { error: profileError } = await supabase.from("profiles").upsert({ user_id: user.id, email: user.email });
        if (profileError) console.error("Error updating profile after sign-in:", profileError);
      }
    } catch (err) {
      setError(err.message || "Could not sign in. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setRecoveryMessage("");
    if (newPassword.length < 6) return setError("Your password must be at least 6 characters.");
    if (newPassword !== confirmNewPassword) return setError("The passwords do not match.");

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setRecoveryMessage("Your password has been updated. Please sign in with your new password.");
    await supabase.auth.signOut();
    setSession(null);
    window.history.replaceState({}, document.title, window.location.pathname);
    setIsRecovery(false);
    setNewPassword("");
    setConfirmNewPassword("");
  };

  if (showSignUp && !isRecovery) return <SignUp />;
  if (showForgotPassword && !isRecovery) return <ForgotPassword onBack={() => setShowForgotPassword(false)} />;
  if (session && !isRecovery) return <Home />;

  return (
    <main style={s.page}>
      <section style={s.card}>
        <AuthBrand />
        <p style={s.eyebrow}>{isRecovery ? "ACCOUNT SECURITY" : "WELCOME BACK"}</p>
        <h1 style={s.title}>{isRecovery ? "Reset your password" : "Log in to Vocabulist"}</h1>
        <p style={s.description}>
          {isRecovery ? "Choose a new password to get back to learning." : "Continue your Dutch learning journey."}
        </p>

        {error && <div role="alert" style={{ ...s.message, ...s.error }}> {error} </div>}
        {recoveryMessage && <div role="status" style={{ ...s.message, ...s.success }}>{recoveryMessage}</div>}

        {isRecovery ? (
          <form onSubmit={handlePasswordUpdate} style={s.form}>
            <div style={s.group}>
              <label htmlFor="new-password" style={s.label}>New password</label>
              <div style={s.passwordWrap}>
                <input id="new-password" type={showNewPassword ? "text" : "password"} autoComplete="new-password" minLength={6} placeholder="At least 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ ...s.input, paddingRight: 52 }} required />
                <button type="button" onClick={() => setShowNewPassword(v => !v)} style={s.eyeButton} aria-label={showNewPassword ? "Hide password" : "Show password"}>{showNewPassword ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 002.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1.1-1.2 2.3-2.3 3.4M6.2 6.2C3.9 7.7 2.8 10 2.5 12c.6 1.7 2.4 4.4 5.8 5.7 1.1.4 2.3.7 3.7.7"/></svg> : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg>}</button>
              </div>
            </div>
            <div style={s.group}>
              <label htmlFor="confirm-new-password" style={s.label}>Confirm new password</label>
              <div style={s.passwordWrap}>
                <input id="confirm-new-password" type={showConfirmNewPassword ? "text" : "password"} autoComplete="new-password" minLength={6} placeholder="Enter it again" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} style={{ ...s.input, paddingRight: 52 }} required />
                <button type="button" onClick={() => setShowConfirmNewPassword(v => !v)} style={s.eyeButton} aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}>{showConfirmNewPassword ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 002.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1.1-1.2 2.3-2.3 3.4M6.2 6.2C3.9 7.7 2.8 10 2.5 12c.6 1.7 2.4 4.4 5.8 5.7 1.1.4 2.3.7 3.7.7"/></svg> : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg>}</button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={{ ...s.button, ...(loading ? s.disabledButton : {}) }}>{loading ? "Updating password…" : "Save new password"}</button>
          </form>
        ) : (
          <form onSubmit={handleLogin} style={s.form}>
            <div style={s.group}>
              <label htmlFor="login-identifier" style={s.label}>Username or email</label>
              <input id="login-identifier" type="text" autoComplete="username" placeholder="Your username or you@email.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} style={s.input} required />
            </div>
            <div style={s.group}>
              <label htmlFor="login-password" style={s.label}>Password</label>
              <div style={s.passwordWrap}>
                <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...s.input, paddingRight: 52 }} required />
                <button type="button" onClick={() => setShowPassword(v => !v)} style={s.eyeButton} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 002.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1.1-1.2 2.3-2.3 3.4M6.2 6.2C3.9 7.7 2.8 10 2.5 12c.6 1.7 2.4 4.4 5.8 5.7 1.1.4 2.3.7 3.7.7"/></svg> : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg>}</button>
              </div>
            </div>
            <div style={s.inlineLinkRow}>
              <button type="button" onClick={() => { setError(""); setShowForgotPassword(true); }} style={s.linkButton}>Forgot your password?</button>
            </div>
            <button type="submit" disabled={loading} style={{ ...s.button, ...(loading ? s.disabledButton : {}) }}>{loading ? "Signing in…" : "Sign In"}</button>
          </form>
        )}

        {!isRecovery && (
          <div style={s.footer}>
            New to Vocabulist? <button type="button" onClick={() => setShowSignUp(true)} style={s.linkButton}>Create an account (Sign Up)</button>
          </div>
        )}
      </section>
    </main>
  );
}

export default Login;
