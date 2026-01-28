import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Home from "./Home";
import SignUp from "./SignUp";


function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);


  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setSession(data.session);
      }
    };
    getSession();


    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });


    return () => {
      subscription.unsubscribe();
    };
  }, []);


  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");


    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });


    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }


    // Save or update profile
    try {
      const user = data.user;
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          user_id: user.id,
          email: user.email,
        });


      if (profileError) throw profileError;
    } catch (error) {
      console.error("Error saving profile:", error);
    }


    setLoading(false);
  };


  if (showSignUp) {
    return <SignUp />;
  }


  if (session) {
    return <Home />;
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
        <p style={styles.subtitle}>Welcome Back</p>


        {error && <div style={styles.error}>❌ {error}</div>}


        <form onSubmit={handleLogin} style={styles.form}>
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
              placeholder="Enter your password"
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
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>


        <div style={styles.footer}>
          Don't have an account?{" "}
          <button
            onClick={() => setShowSignUp(true)}
            style={styles.link}
            onMouseEnter={(e) => Object.assign(e.target.style, styles.linkHover)}
            onMouseLeave={(e) => {
              e.target.style.color = "#06b6d4";
            }}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}


export default Login;