import React, { useState, useEffect, useRef } from "react";
import "../App.css";
import Play from "./Play";
import Review from "./Review";
import YourWords from "./YourWords";
import Leaderboard from "./Leaderboard";
import Achievements from "./Achievements";
import Settings from "./Settings";
import Practice from "./Practice";
import { supabase } from "../supabaseClient";

/**
 * One music player stays mounted while Home switches between its screens.
 * Browsers may block autoplay until the user interacts; if so, retry on the
 * first interaction without showing any extra music controls.
 */
function BackgroundMusic() {
  const audioRef = useRef(null);
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem("backgroundMusicEnabled") !== "false"
  );

  useEffect(() => {
    const syncPreference = () => {
      setEnabled(localStorage.getItem("backgroundMusicEnabled") !== "false");
    };
    window.addEventListener("background-music-setting-changed", syncPreference);
    window.addEventListener("storage", syncPreference);
    return () => {
      window.removeEventListener("background-music-setting-changed", syncPreference);
      window.removeEventListener("storage", syncPreference);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let disposed = false;
    const tryPlay = async () => {
      if (disposed || !audioRef.current) return;
      if (!enabled) {
        audio.pause();
        return;
      }
      try {
        await audio.play();
      } catch {
        // Autoplay may be blocked. Retry after a real user interaction.
      }
    };

    const onFirstInteraction = () => {
      if (enabled) tryPlay();
    };

    if (enabled) {
      audio.volume = 0.18;
      tryPlay();
      document.addEventListener("pointerdown", onFirstInteraction);
      document.addEventListener("keydown", onFirstInteraction);
    } else {
      audio.pause();
      audio.currentTime = 0;
    }

    return () => {
      disposed = true;
      document.removeEventListener("pointerdown", onFirstInteraction);
      document.removeEventListener("keydown", onFirstInteraction);
    };
  }, [enabled]);

  return (
    <audio
      ref={audioRef}
      src="/background-classical.wav"
      loop
      preload="auto"
      aria-hidden="true"
      style={{ display: "none" }}
    />
  );
}

function Home() {
  const [screen, setScreen] = useState("menu");
  const [userId, setUserId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) setUserId(userData.user.id);
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    // Stop music immediately on logout, before the login screen appears.
    const audio = document.querySelector("audio[src='/background-classical.wav']");
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    await supabase.auth.signOut();
  };

  const handleUserClick = (clickedUserId) => {
    setSelectedUserId(clickedUserId);
    setScreen("achievements");
  };

  let activeScreen;
  if (screen === "play") activeScreen = <Play goBack={() => setScreen("menu")} />;
  else if (screen === "review") activeScreen = <Review goBack={() => setScreen("menu")} />;
  else if (screen === "practice") activeScreen = <Practice goBack={() => setScreen("menu")} />;
  else if (screen === "yourwords") activeScreen = <YourWords goBack={() => setScreen("menu")} />;
  else if (screen === "leaderboard") {
    activeScreen = (
      <Leaderboard
        goBack={() => setScreen("menu")}
        onUserClick={handleUserClick}
      />
    );
  } else if (screen === "achievements") {
    activeScreen = (
      <Achievements
        goBack={() => setScreen("menu")}
        userId={selectedUserId || userId}
      />
    );
  } else if (screen === "settings") {
    activeScreen = <Settings goBack={() => setScreen("menu")} />;
  } else {
    const buttons = [
      { label: "🎮 Play", screen: "play" },
      { label: "📝 Review Mode", screen: "review" },
      { label: "📚 Practice Mode", screen: "practice" },
      { label: "📖 Your Words", screen: "yourwords" },
      { label: "🏆 Leaderboard", screen: "leaderboard" },
      { label: "🎖️ Achievements", screen: "achievements" },
      { label: "⚙️ Settings", screen: "settings" },
    ];
    activeScreen = (
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

  return (
    <>
      <BackgroundMusic />
      {activeScreen}
    </>
  );
}

export default Home;
