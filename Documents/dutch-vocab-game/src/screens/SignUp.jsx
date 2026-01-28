import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import Login from "./Login";


function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showLogin, setShowLogin] = useState(false);


  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);


    // Validation
    if (!username.trim()) {
      setError("Please enter a username!");
      setLoading(false);
      return;
    }


    if (username.length < 3) {
      setError("Username must be at least 3 characters!");
      setLoading(false);
      return;
    }


    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      setLoading(false);
      return;
    }


    if (password.length < 6) {
      setError("Password must be at least 6 characters!");
      setLoading(false);
      return;
    }


    try {
      // Register user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });


      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }


      // Create user profile with username
      const user = data.user;
      if (user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            email: user.email,
            username: username.trim(),
          });


        if (profileError) {
          console.error("Error saving profile:", profileError);
        }
      }


      setSuccess(true);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setUsername("");


      // Redirect to login after 2 seconds
      setTimeout(() => {
        setShowLogin(true);
      }, 2000);
    } catch (error) {
      setError("Sign up failed: " + error.message);
    }


    setLoading(false);
  };


  if (showLogin) {
    return <Login />;
  }


  const styles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
      padding: "0",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    },
    card: {
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: "12px",
      padding: "40px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      maxWidth: "420px",
      width: "100%",
      margin: "20px",
      boxSizing: "border-box",
    },
    title: {
      fontSize: "clamp(24px, 6vw, 32px)",
      fontWeight: "800",
      margin: "0 0 12px 0",
      color: "white",
      textShadow: "0 2px 8px rgba(6,182,212,0.3)",
      textAlign: "center",
    },
    subtitle: {
      fontSize: "clamp(12px, 2.5vw, 14px)",
      color: "#06b6d4",
      margin: "0 0 28px 0",
      textAlign: "center",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      fontWeight: "600",
    },
    form: {
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    },
    formGroup: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    },
    label: {
      fontSize: "clamp(12px, 2.5vw, 13px)",
      color: "#bfdbfe",
      fontWeight: "600",
    },
    input: {
      padding: "12px 14px",
      fontSize: "clamp(13px, 3vw, 14px)",
      border: "1px solid rgba(6,182,212,0.3)",
      borderRadius: "8px",
      background: "rgba(255,255,255,0.95)",
      color: "#0f172a",
      transition: "all 0.2s ease",
      fontFamily: "inherit",
      boxSizing: "border-box",
    },
    inputFocus: {
      borderColor: "#06b6d4",
      outline: "none",
      boxShadow: "0 0 0 3px rgba(6,182,212,0.2)",
    },
    button: {
      padding: "12px 24px",
      fontSize: "clamp(13px, 2.5vw, 14px)",
      fontWeight: "700",
      background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
      color: "white",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      transition: "all 0.2s ease",
      boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
      marginTop: "8px",
    },
    buttonHover: {
      transform: "translateY(-2px)",
      boxShadow: "0 6px 20px rgba(59, 130, 246, 0.4)",
    },
    buttonDisabled: {
      opacity: 0.6,
      cursor: "not-allowed",
    },
    error: {
      background: "rgba(239, 68, 68, 0.15)",
      border: "1px solid rgba(239, 68, 68, 0.3)",
      color: "#fca5a5",
      padding: "12px",
      borderRadius: "8px",
      fontSize: "clamp(12px, 2.5vw, 13px)",
      fontWeight: "500",
      marginBottom: "16px",
      textAlign: "center",
    },
    success: {
      background: "rgba(34, 197, 94, 0.15)",
      border: "1px solid rgba(34, 197, 94, 0.3)",
      color: "#86efac",
      padding: "12px",
      borderRadius: "8px",
      fontSize: "clamp(12px, 2.5vw, 13px)",
      fontWeight: "500",
      marginBottom: "16px",
      textAlign: "center",
    },
    footer: {
      marginTop: "24px",
      textAlign: "center",
      fontSize: "clamp(12px, 2.5vw, 13px)",
      color: "#bfdbfe",
    },
    link: {
      background: "none",
      border: "none",
      color: "#06b6d4",
      cursor: "pointer",
      textDecoration: "underline",
      font: "inherit",
      fontSize: "inherit",
      fontWeight: "600",
      transition: "color 0.2s ease",
    },
    linkHover: {
      color: "#3b82f6",
    },
  };


  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎮 Vocabulist</h1>
        <p style={styles.subtitle}>Create Account</p>


        {success && (
          <div style={styles.success}>
            ✅ Account created! Redirecting to login...
          </div>
        )}


        {error && <div style={styles.error}>❌ {error}</div>}


        <form onSubmit={handleSignUp} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              placeholder="e.g. Mario, Player1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(6,182,212,0.3)";
                e.target.style.boxShadow = "none";
              }}
              style={styles.input}
              required
            />
          </div>


          <div style={styles.formGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(6,182,212,0.3)";
                e.target.style.boxShadow = "none";
              }}
              style={styles.input}
              required
            />
          </div>


          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(6,182,212,0.3)";
                e.target.style.boxShadow = "none";
              }}
              style={styles.input}
              required
            />
          </div>


          <div style={styles.formGroup}>
            <label style={styles.label}>Confirm Password</label>
            <input
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(6,182,212,0.3)";
                e.target.style.boxShadow = "none";
              }}
              style={styles.input}
              required
            />
          </div>


          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
            onMouseEnter={(e) => {
              if (!loading) Object.assign(e.target.style, styles.buttonHover);
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "none";
              e.target.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
            }}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>


        <div style={styles.footer}>
          Already have an account?{" "}
          <button
            onClick={() => setShowLogin(true)}
            style={styles.link}
            onMouseEnter={(e) => Object.assign(e.target.style, styles.linkHover)}
            onMouseLeave={(e) => {
              e.target.style.color = "#06b6d4";
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}


export default SignUp;