import React, { useState } from "react";
import Play from "./Play";
import Review from "./Review";
import YourWords from "./YourWords";
import Leaderboard from "./Leaderboard";
import Achievements from "./Achievements";
import Settings from "./Settings";
import Practice from "./Practice";
import { supabase } from "../supabaseClient";

function Home() {
  console.log("DEBUG: Home render");
  const [screen, setScreen] = useState("menu");
  const [userId, setUserId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);

  React.useEffect(() => {
    const getUser = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        setUserId(userData.user.id);
      }
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleUserClick = (clickedUserId, username) => {
    setSelectedUserId(clickedUserId);
    setScreen("achievements");
  };

  if (screen === "play") return <Play goBack={() => setScreen("menu")} />;
  if (screen === "review") return <Review goBack={() => setScreen("menu")} />;
  if (screen === "practice") return <Practice goBack={() => setScreen("menu")} />;
  if (screen === "yourwords") return <YourWords goBack={() => setScreen("menu")} />;
  if (screen === "leaderboard")
    return (
      <Leaderboard
        goBack={() => setScreen("menu")}
        onUserClick={handleUserClick}
      />
    );
  if (screen === "achievements")
    return (
      <Achievements
        goBack={() => setScreen("menu")}
        userId={selectedUserId || userId}
      />
    );
  if (screen === "settings") return <Settings goBack={() => setScreen("menu")} />;

  // Menu principale
  const styles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
      padding: "40px 20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    },
    header: {
      textAlign: "center",
      marginBottom: "50px",
      color: "white",
    },
    title: {
      fontSize: "52px",
      fontWeight: "800",
      margin: "0",
      textShadow: "0 4px 15px rgba(6,182,212,0.4)",
      letterSpacing: "2px",
    },
    subtitle: {
      fontSize: "16px",
      color: "#06b6d4",
      margin: "10px 0 0 0",
      fontWeight: "500",
    },
    buttonsContainer: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "16px",
      maxWidth: "900px",
      width: "100%",
      marginBottom: "40px",
    },
    button: {
      padding: "20px",
      fontSize: "16px",
      fontWeight: "700",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      transition: "all 0.3s ease",
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      color: "white",
      border: "1px solid rgba(6,182,212,0.3)",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      minHeight: "70px",
    },
    buttonHover: {
      transform: "translateY(-4px)",
      boxShadow: "0 8px 25px rgba(6,182,212,0.3)",
    },
    logoutButton: {
      padding: "14px 40px",
      fontSize: "16px",
      fontWeight: "600",
      background: "rgba(239, 68, 68, 0.8)",
      color: "white",
      border: "1px solid rgba(239, 68, 68, 1)",
      borderRadius: "8px",
      cursor: "pointer",
      transition: "all 0.3s ease",
      textAlign: "center",
    },
  };

  const buttons = [
    { label: "🎮 Play", screen: "play" },
    { label: "📝 Review Mode", screen: "review" },
    { label: "📚 Practice Mode", screen: "practice" },
    { label: "📖 Your Words", screen: "yourwords" },
    { label: "🏆 Leaderboard", screen: "leaderboard" },
    { label: "🎖️ Achievements", screen: "achievements" },
    { label: "⚙️ Settings", screen: "settings" },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🌍 VOCABULIST</h1>
        <p style={styles.subtitle}>Master Dutch Words Faster</p>
      </div>

      <div style={styles.buttonsContainer}>
        {buttons.map((btn, idx) => (
          <button
            key={idx}
            style={styles.button}
            onClick={() => setScreen(btn.screen)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = styles.buttonHover.transform;
              e.currentTarget.style.boxShadow = styles.buttonHover.boxShadow;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <button
        onClick={handleLogout}
        style={styles.logoutButton}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(239, 68, 68, 1)";
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(239, 68, 68, 0.8)";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        🚪 Logout
      </button>
    </div>
  );
}

export default Home;
