import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Leaderboard({ goBack }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [userBestScore, setUserBestScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user.id;

        // Prendi l'username dell'user
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", userId)
          .single();

        const userUsername = userProfile?.username || "Unknown";

        // Prendi i migliori score di ogni user
        const { data: sessions } = await supabase
          .from("sessions")
          .select("user_id, score")
          .order("score", { ascending: false });

        // Raggruppa per user e prendi il migliore
        const userScores = new Map();
        sessions?.forEach((session) => {
          if (!userScores.has(session.user_id)) {
            userScores.set(session.user_id, session.score);
          } else {
            userScores.set(
              session.user_id,
              Math.max(userScores.get(session.user_id), session.score)
            );
          }
        });

        // Prendi gli username di tutti gli user
        const userIds = Array.from(userScores.keys());
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("user_id, username")
          .in("user_id", userIds);

        // Combina i dati
        const leaderboardData = allProfiles
          ?.map((profile) => ({
            user_id: profile.user_id,
            username: profile.username || "Unknown",
            score: userScores.get(profile.user_id),
          }))
          .sort((a, b) => b.score - a.score) || [];

        setLeaderboard(leaderboardData);

        // Trova il rank dell'user
        const userIndex = leaderboardData.findIndex(
          (entry) => entry.user_id === userId
        );
        const userScore = userScores.get(userId) || 0;
        setUserRank(userIndex + 1);
        setUserBestScore(userScore);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h1>Loading...</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h1>🏆 Leaderboard</h1>

      {userRank && (
        <div style={{ fontSize: "20px", marginBottom: "30px", backgroundColor: "#fff3cd", padding: "15px", borderRadius: "8px" }}>
          <p>Your Rank: <strong>#{userRank}</strong> | Best Score: <strong>{userBestScore}</strong></p>
        </div>
      )}

      <table style={{ width: "100%", maxWidth: "600px", margin: "0 auto", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "#f0f0f0", borderBottom: "2px solid #333" }}>
            <th style={{ padding: "10px", textAlign: "left" }}>Rank</th>
            <th style={{ padding: "10px", textAlign: "left" }}>Username</th>
            <th style={{ padding: "10px", textAlign: "right" }}>Best Score</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((entry, index) => (
            <tr key={entry.user_id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "10px" }}>
                {index === 0 && "🥇"}
                {index === 1 && "🥈"}
                {index === 2 && "🥉"}
                {index > 2 && `#${index + 1}`}
              </td>
              <td style={{ padding: "10px" }}>{entry.username}</td>
              <td style={{ padding: "10px", textAlign: "right" }}>
                <strong>{entry.score}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={goBack} style={{ marginTop: "30px" }}>
        Back to Menu
      </button>
    </div>
  );
}

export default Leaderboard;