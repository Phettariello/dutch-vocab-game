import React, { useState, useEffect } from "react";
import Play from "./Play";
import Review from "./Review";
import YourWords from "./YourWords";
import Leaderboard from "./Leaderboard";
import MedalLeaderboard from "./MedalLeaderboard";
import Achievements from "./Achievements";
import Settings from "./Settings";
import Practice from "./Practice";
import userprofile from "./userprofile";
import { supabase } from "../supabaseClient";

function Home() {
  console.log("DEBUG: Home render");
  const [screen, setScreen] = useState("menu");
  const [userId, setUserId] = useState(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setUserId(data.session.user.id);
      }
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleLeaderboardUserClick = (clickedUserId, clickedUsername) => {
    setSelectedUserProfile({
      userId: clickedUserId,
      username: clickedUsername,
    });
  };

  if (screen === "play") return <Play goBack={() => setScreen("menu")} />;
  if (screen === "review") return <Review goBack={() => setScreen("menu")} />;
  if (screen === "practice")
    return <Practice goBack={() => setScreen("menu")} />;
  if (screen === "yourwords")
    return <YourWords goBack={() => setScreen("menu")} />;
  if (screen === "leaderboard")
    return (
      <>
        <Leaderboard
          onUserClick={handleLeaderboardUserClick}
          goBack={() => setScreen("menu")}
        />
        {selectedUserProfile && (
          <userprofile
            userId={selectedUserProfile.userId}
            username={selectedUserProfile.username}
            onClose={() => setSelectedUserProfile(null)}
          />
        )}
      </>
    );
  if (screen === "medalLeaderboard")
    return (
      <MedalLeaderboard goBack={() => setScreen("menu")} />
    );
  if (screen === "achievements")
    return (
      <Achievements goBack={() => setScreen("menu")} userId={userId} />
    );
  if (screen === "settings") return <Settings goBack={() => setScreen("menu")} />;

  const menuStyles = {
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
      color: "white",
      marginBottom: "50px",
    },
    title: {
      fontSize: "48px",
      fontWeight: "bold",
      margin: "0 0 10px 0",
      textShadow: "0 2px 10px rgba(0,0,0,0.3)",
    },
    subtitle: {
      fontSize: "16px",
      color: "#06b6d4",
      margin: "0",
    },
    buttonGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "12px",
      maxWidth: "600px",
      width: "100%",
      marginBottom: "30px",
    },
    button: {
      padding: "16px 20px",
      fontSize: "15px",
      fontWeight: "600",
      border: "none",
      borderRadius: "10px",
      cursor: "pointer",
      transition: "all 0.3s ease",
      color: "white",
      background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
      border: "1px solid rgba(6,182,212,0.2)",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
    },
    buttonHover: {
      transform: "translateY(-2px)",
      boxShadow: "0 6px 20px rgba(6,182,212,0.3)",
    },
    specialButton: {
      background: "linear-gradient(135deg, #f97316 0%, #fbbf24 100%)",
      color: "#0f172a",
      border: "1px solid rgba(249,115,22,0.3)",
    },
    logoutButton: {
      padding: "12px 30px",
      fontSize: "14px",
      fontWeight: "600",
      border: "1px solid rgba(255,255,255,0.3)",
      borderRadius: "8px",
      background: "rgba(255,255,255,0.1)",
      color: "white",
      cursor: "pointer",
      transition: "all 0.3s ease",
    },
  };

  return (
    <div style={menuStyles.container}>
      <div style={menuStyles.header}>
        <h1 style={menuStyles.title}>🎮 VOCABULIST</h1>
        <p style={menuStyles.subtitle}>Master Dutch Words • Level Up Your Skills</p>
      </div>

      <div style={menuStyles.buttonGrid}>
        <button
          style={menuStyles.button}
          onClick={() => setScreen("play")}
          onMouseEnter={(e) =>
            Object.assign(e.target.style, menuStyles.buttonHover)
          }
          onMouseLeave={(e) => {
            e.target.style.transform = "none";
            e.target.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
          }}
        >
          🎯 Play
        </button>

        <button
          style={menuStyles.button}
          onClick={() => setScreen("review")}
          onMouseEnter={(e) =>
            Object.assign(e.target.style, menuStyles.buttonHover)
          }
          onMouseLeave={(e) => {
            e.target.style.transform = "none";
            e.target.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
          }}
        >
          📝 Review Mode
        </button>

        <button
          style={menuStyles.button}
          onClick={() => setScreen("practice")}
          onMouseEnter={(e) =>
            Object.assign(e.target.style, menuStyles.buttonHover)
          }
          onMouseLeave={(e) => {
            e.target.style.transform = "none";
            e.target.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
          }}
        >
          📚 Practice
        </button>

        <button
          style={menuStyles.button}
          onClick={() => setScreen("yourwords")}
          onMouseEnter={(e) =>
            Object.assign(e.target.style, menuStyles.buttonHover)
          }
          onMouseLeave={(e) => {
            e.target.style.transform = "none";
            e.target.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
          }}
        >
          📖 Your Words
        </button>

        <button
          style={{ ...menuStyles.button, ...menuStyles.specialButton }}
          onClick={() => setScreen("leaderboard")}
          onMouseEnter={(e) =>
            Object.assign(e.target.style, menuStyles.buttonHover)
          }
          onMouseLeave={(e) => {
            e.target.style.transform = "none";
            e.target.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
          }}
        >
          🏆 Leaderboard
        </button>

        <button
          style={{ ...menuStyles.button, ...menuStyles.specialButton }}
          onClick={() => setScreen("medalLeaderboard")}
          onMouseEnter={(e) =>
            Object.assign(e.target.style, menuStyles.buttonHover)
          }
          onMouseLeave={(e) => {
            e.target.style.transform = "none";
            e.target.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
          }}
        >
          🏅 Medal Champions
        </button>

        <button
          style={{ ...menuStyles.button, ...menuStyles.specialButton }}
          onClick={() => setScreen("achievements")}
          onMouseEnter={(e) =>
            Object.assign(e.target.style, menuStyles.buttonHover)
          }
          onMouseLeave={(e) => {
            e.target.style.transform = "none";
            e.target.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
          }}
        >
          🎖️ My Achievements
        </button>

        <button
          style={menuStyles.button}
          onClick={() => setScreen("settings")}
          onMouseEnter={(e) =>
            Object.assign(e.target.style, menuStyles.buttonHover)
          }
          onMouseLeave={(e) => {
            e.target.style.transform = "none";
            e.target.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
          }}
        >
          ⚙️ Settings
        </button>
      </div>

      <button
        onClick={handleLogout}
        style={menuStyles.logoutButton}
        onMouseEnter={(e) => {
          e.target.style.background = "rgba(255,255,255,0.2)";
        }}
        onMouseLeave={(e) => {
          e.target.style.background = "rgba(255,255,255,0.1)";
        }}
      >
        🚪 Logout
      </button>
    </div>
  );
}

export default Home;
