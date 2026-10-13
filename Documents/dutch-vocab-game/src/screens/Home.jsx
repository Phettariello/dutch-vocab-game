import React, { useState } from "react";
import "./App.css";
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

  // Main menu: compact single-column layout for mobile screens.
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
    <main className="vocabulist-home">
      <header className="vocabulist-home-header">
        <h1 className="vocabulist-home-title">🌍 VOCABULIST</h1>
        <p className="vocabulist-home-subtitle">Master Dutch Words Faster</p>
      </header>

      <nav className="vocabulist-menu" aria-label="Main menu">
        {buttons.map((btn) => (
          <button
            key={btn.screen}
            className="vocabulist-menu-button"
            onClick={() => setScreen(btn.screen)}
          >
            {btn.label}
          </button>
        ))}
      </nav>

      <button className="vocabulist-logout-button" onClick={handleLogout}>
        🚪 Logout
      </button>
    </main>
  );
}

export default Home;
