import React, { useState } from "react";
import Play from "./Play";
import Review from "./Review";
import YourWords from "./YourWords";
import Leaderboard from "./Leaderboard";
import Settings from "./Settings";
import Practice from "./Practice";
import { supabase } from "../supabaseClient";



function Home() {
    console.log("DEBUG: Home render");
  const [screen, setScreen] = useState("menu");



  const handleLogout = async () => {
    await supabase.auth.signOut();
  };



  if (screen === "play") return <Play goBack={() => setScreen("menu")} />;
  if (screen === "review") return <Review goBack={() => setScreen("menu")} />;
  if (screen === "practice") return <Practice goBack={() => setScreen("menu")} />;
  if (screen === "yourwords") return <YourWords goBack={() => setScreen("menu")} />;
  if (screen === "leaderboard") return <Leaderboard goBack={() => setScreen("menu")} />;
  if (screen === "settings") return <Settings goBack={() => setScreen("menu")} />;



  // Menu principale
  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h1>Vocabulist – Home</h1>



      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "200px", margin: "20px auto" }}>
        <button onClick={() => setScreen("play")}>Play</button>
        <button onClick={() => setScreen("review")}>Review Mode</button>
        <button onClick={() => setScreen("practice")}>📚 Practice Mode</button>
        <button onClick={() => setScreen("yourwords")}>📖 Your Words</button>
        <button onClick={() => setScreen("leaderboard")}>Leaderboard</button>
        <button onClick={() => setScreen("settings")}>Settings</button>
      </div>



      <button
        onClick={handleLogout}
        style={{ marginTop: "20px", background: "#ccc" }}
      >
        Logout
      </button>
    </div>
  );
}



export default Home;