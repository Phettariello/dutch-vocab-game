import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import Login from "./Login";

function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validazione
    if (!nickname.trim()) {
      setError("Per favore scegli un nickname!");
      setLoading(false);
      return;
    }

    if (nickname.length < 3) {
      setError("Il nickname deve essere almeno 3 caratteri!");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Le password non corrispondono!");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("La password deve essere almeno 6 caratteri!");
      setLoading(false);
      return;
    }

    try {
      // Registra l'utente
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Crea il profilo utente con nickname
      const user = data.user;
      if (user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            email: user.email,
            nickname: nickname.trim(),
          });

        if (profileError) {
          console.error("Errore nel salvataggio del profilo:", profileError);
        }
      }

      setSuccess(true);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setNickname("");

      // Reindirizza a login dopo 2 secondi
      setTimeout(() => {
        setShowLogin(true);
      }, 2000);
    } catch (error) {
      setError("Errore durante la registrazione: " + error.message);
    }

    setLoading(false);
  };

  if (showLogin) {
    return <Login />;
  }

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h1>Vocabulist – Registrazione</h1>

      {success && (
        <p style={{ color: "green" }}>
          ✅ Registrazione completata! Reindirizzamento al login...
        </p>
      )}

      {error && <p style={{ color: "red" }}>❌ {error}</p>}

      <form onSubmit={handleSignUp} style={{ marginTop: "20px" }}>
        <input
          type="text"
          placeholder="Nickname (es. Mario, Player1)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          style={{ display: "block", margin: "10px auto", padding: "8px", width: "250px" }}
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ display: "block", margin: "10px auto", padding: "8px", width: "250px" }}
        />

        <input
          type="password"
          placeholder="Password (minimo 6 caratteri)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ display: "block", margin: "10px auto", padding: "8px", width: "250px" }}
        />

        <input
          type="password"
          placeholder="Conferma Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          style={{ display: "block", margin: "10px auto", padding: "8px", width: "250px" }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 30px",
            fontSize: "16px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Registrazione..." : "Registrati"}
        </button>
      </form>

      <p style={{ marginTop: "20px" }}>
        Hai già un account?{" "}
        <button
          onClick={() => setShowLogin(true)}
          style={{
            background: "none",
            border: "none",
            color: "blue",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Accedi
        </button>
      </p>
    </div>
  );
}

export default SignUp;