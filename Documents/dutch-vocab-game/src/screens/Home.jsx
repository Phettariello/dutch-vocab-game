import React, { useState, useEffect, useRef } from "react";
import "../App.css";
import Play from "./Play";
import Review from "./Review";
import YourWords from "./YourWords";
import Leaderboard from "./Leaderboard";
import Achievements from "./Achievements";
import Settings from "./Settings";
import Practice from "./Practice";
import AuthBrand from "./AuthBrand";
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
      src="/background-music.mp3"
      loop
      preload="auto"
      aria-hidden="true"
      style={{ display: "none" }}
    />
  );
}

// Same level thresholds as the Achievements screen
const LEVELS = [
  { code: "A0", name: "Beginner", min: 0, max: 500 },
  { code: "A1", name: "Elementary", min: 501, max: 1000 },
  { code: "B1", name: "Intermediate", min: 1001, max: 1500 },
  { code: "B2", name: "Upper Intermediate", min: 1501, max: 2000 },
  { code: "C1", name: "Advanced", min: 2001, max: 2500 },
  { code: "C2", name: "Mastery", min: 2501, max: 3000 },
];

function getLevelInfo(wordsMastered) {
  if (wordsMastered >= 3000) {
    return { ...LEVELS[5], progress: 100, nextCode: null };
  }
  let index = LEVELS.findIndex(
    (l) => wordsMastered >= l.min && wordsMastered <= l.max
  );
  if (index < 0) index = 0;
  const level = LEVELS[index];
  const progress = Math.min(
    100,
    Math.max(0, ((wordsMastered - level.min) / (level.max - level.min)) * 100)
  );
  return { ...level, progress, nextCode: LEVELS[index + 1]?.code || null };
}

const HERO = {
  screen: "play",
  icon: "🎮",
  title: "Play",
  text: "Climb levels, build streaks, earn medals",
  accent: "#67e8f9",
  soft: "rgba(103,232,249,0.2)",
};

const MENU_ITEMS = [
  { screen: "review", icon: "📝", title: "Review", text: "Revisit the words you practised", accent: "#38bdf8", soft: "rgba(56,189,248,0.18)" },
  { screen: "practice", icon: "📚", title: "Practice", text: "Train by category and level", accent: "#a78bfa", soft: "rgba(167,139,250,0.18)" },
  { screen: "yourwords", icon: "📖", title: "Your Words", text: "Browse your vocabulary", accent: "#34d399", soft: "rgba(52,211,153,0.18)" },
  { screen: "leaderboard", icon: "🏆", title: "Leaderboard", text: "See who is on top", accent: "#fbbf24", soft: "rgba(251,191,36,0.18)" },
  { screen: "achievements", icon: "🎖️", title: "Achievements", text: "Your level and medals", accent: "#f472b6", soft: "rgba(244,114,182,0.18)" },
  { screen: "settings", icon: "⚙️", title: "Settings", text: "Account, sound and music", accent: "#94a3b8", soft: "rgba(148,163,184,0.18)" },
];

function Home() {
  const [screen, setScreen] = useState("menu");
  const [userId, setUserId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [profile, setProfile] = useState({
    loaded: false,
    username: "",
    bestScore: 0,
    mastered: 0,
  });

  // Load the profile summary every time the menu is shown
  // (so it updates right after you finish a game)
  useEffect(() => {
    if (screen !== "menu") return;
    let active = true;

    const loadProfile = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user || !active) return;
        setUserId(user.id);

        const [profileRes, bestRes, masteredRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("username")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("sessions")
            .select("score")
            .eq("user_id", user.id)
            .order("score", { ascending: false })
            .limit(1),
          supabase
            .from("user_progress")
            .select("word_id")
            .eq("user_id", user.id)
            .eq("mastered", true),
        ]);

        if (!active) return;
        setProfile({
          loaded: true,
          username:
            profileRes.data?.username || user.email?.split("@")[0] || "Player",
          bestScore: bestRes.data?.[0]?.score ?? 0,
          mastered: new Set((masteredRes.data || []).map((r) => r.word_id)).size,
        });
      } catch (error) {
        console.error("Error loading profile summary:", error);
        if (active) setProfile((p) => ({ ...p, loaded: true }));
      }
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, [screen]);

  const handleLogout = async () => {
    // Stop music immediately on logout, before the login screen appears.
    const audio = document.querySelector("audio[src='/background-music.mp3']");
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

  const openScreen = (name) => {
    // Opening Achievements from the menu always shows your own profile
    if (name === "achievements") setSelectedUserId(null);
    setScreen(name);
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
    const level = getLevelInfo(profile.mastered);
    const shown = (value) => (profile.loaded ? value : "–");
    const initial = (profile.username || "?").charAt(0).toUpperCase();

    activeScreen = (
      <main className="vocabulist-home">
        <div className="vh-inner">
          <header className="vh-brand">
            <AuthBrand compact />
          </header>

          <section className="vh-profile" aria-label="Your profile">
            <div className="vh-profile-top">
              <div className="vh-avatar" aria-hidden="true">
                {initial}
              </div>
              <div className="vh-profile-id">
                <p className="vh-hello">Welcome back</p>
                <h2 className="vh-username">
                  {profile.loaded ? profile.username : "Loading…"}
                </h2>
              </div>
              <div className="vh-level-chip" title={level.name}>
                <span className="vh-level-code">{shown(level.code)}</span>
                <span className="vh-level-name">{shown(level.name)}</span>
              </div>
            </div>

            <div className="vh-stats">
              <div className="vh-stat">
                <span className="vh-stat-value">
                  {shown(profile.bestScore.toLocaleString())}
                </span>
                <span className="vh-stat-label">🏆 Best score</span>
              </div>
              <div className="vh-stat">
                <span className="vh-stat-value">
                  {shown(profile.mastered.toLocaleString())}
                </span>
                <span className="vh-stat-label">📖 Words mastered</span>
              </div>
            </div>

            <div
              className="vh-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(level.progress)}
            >
              <span style={{ width: `${profile.loaded ? level.progress : 0}%` }} />
            </div>
            <p className="vh-progress-text">
              {profile.loaded
                ? level.nextCode
                  ? `${profile.mastered} / ${level.max} words to reach ${level.nextCode}`
                  : `${profile.mastered} / ${level.max} words`
                : " "}
            </p>
          </section>

          <nav className="vh-grid" aria-label="Main menu">
            <button
              className="vh-card vh-card--hero"
              style={{ "--accent": HERO.accent, "--accent-soft": HERO.soft }}
              onClick={() => openScreen(HERO.screen)}
            >
              <span className="vh-card-icon">{HERO.icon}</span>
              <span className="vh-card-body">
                <span className="vh-card-title">{HERO.title}</span>
                <span className="vh-card-text">{HERO.text}</span>
              </span>
              <span className="vh-card-arrow" aria-hidden="true">
                ›
              </span>
            </button>

            {MENU_ITEMS.map((item) => (
              <button
                key={item.screen}
                className="vh-card"
                style={{ "--accent": item.accent, "--accent-soft": item.soft }}
                onClick={() => openScreen(item.screen)}
              >
                <span className="vh-card-icon">{item.icon}</span>
                <span className="vh-card-body">
                  <span className="vh-card-title">{item.title}</span>
                  <span className="vh-card-text">{item.text}</span>
                </span>
              </button>
            ))}
          </nav>

          <button className="vh-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
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
