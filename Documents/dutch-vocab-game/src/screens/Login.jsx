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

    // Salva o aggiorna il profilo
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

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h1>Vocabulist – Login</h1>

      {error && <p style={{ color: "red" }}>❌ {error}</p>}

      <form onSubmit={handleLogin} style={{ marginTop: "20px" }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: "block", margin: "10px auto", padding: "8px", width: "250px" }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: "block", margin: "10px auto", padding: "8px", width: "250px" }}
        />

        <button type="submit" disabled={loading} style={{ padding: "10px 30px", fontSize: "16px" }}>
          {loading ? "Login..." : "Login"}
        </button>
      </form>

      <p style={{ marginTop: "20px" }}>
        Non hai un account?{" "}
        <button
          onClick={() => setShowSignUp(true)}
          style={{
            background: "none",
            border: "none",
            color: "blue",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Registrati
        </button>
      </p>
    </div>
  );
}

export default Login;
