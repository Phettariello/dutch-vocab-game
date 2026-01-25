import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Login from "./screens/Login";
import Home from "./screens/Home";
import Play from "./screens/Play";
import Leaderboard from "./screens/Leaderboard";

function App() {
  const [user, setUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState("login");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setCurrentScreen("home");
        } else {
          setCurrentScreen("login");
        }
      } catch (error) {
        console.error("Error checking user:", error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        setCurrentScreen("home");
      } else {
        setUser(null);
        setCurrentScreen("login");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setCurrentScreen("login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (loading) {
    return (
      <div style={loadingStyles.container}>
        <h1>Loading...</h1>
      </div>
    );
  }

  return (
    <>
      {currentScreen === "login" && <Login />}
      {currentScreen === "home" && (
        <Home
          onPlay={() => setCurrentScreen("play")}
          onLeaderboard={() => setCurrentScreen("leaderboard")}
          onLogout={handleLogout}
        />
      )}
      {currentScreen === "play" && (
        <Play goBack={() => setCurrentScreen("home")} />
      )}
      {currentScreen === "leaderboard" && (
        <Leaderboard goBack={() => setCurrentScreen("home")} />
      )}
    </>
  );
}

const loadingStyles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};

export default App;
