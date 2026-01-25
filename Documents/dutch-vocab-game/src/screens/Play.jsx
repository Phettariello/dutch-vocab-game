import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Play({ goBack }) {
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [streak, setStreak] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [sessionResults, setSessionResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLevel, setUserLevel] = useState(1); // 🆕 Traccia il livello

  useEffect(() => {
    const fetchWords = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user.id;

        // 🆕 Prendi il numero di parole masterate per calcolare il livello
        const { data: masteredWords } = await supabase
          .from("user_progress")
          .select("id")
          .eq("user_id", userId)
          .eq("mastered", true);

        const masteredCount = masteredWords?.length || 0;
        let maxDifficulty = 3; // Default: difficoltà 1-3

        if (masteredCount >= 50) {
          maxDifficulty = 10; // Livello 3: tutte le difficoltà
        } else if (masteredCount >= 20) {
          maxDifficulty = 5; // Livello 2: difficoltà 1-5
        }

        setUserLevel(
          masteredCount >= 50 ? 3 : masteredCount >= 20 ? 2 : 1
        );

        // 🆕 Filtra per difficoltà massima
        const { data, error } = await supabase
          .from("words")
          .select("*")
          .lte("difficulty", maxDifficulty)
          .limit(20);

        if (error) throw error;
        const shuffled = data.sort(() => Math.random() - 0.5);
        setWords(shuffled);
      } catch (error) {
        console.error("Error fetching words:", error);
        alert("Failed to load words.");
        goBack();
      } finally {
        setLoading(false);
      }
    };

    fetchWords();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h1>Loading...</h1>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h1>No words available</h1>
        <button onClick={goBack}>Back to Menu</button>
      </div>
    );
  }

  const currentWord = words[currentIndex];

  const handleSubmit = (e) => {
    e.preventDefault();
    const userAnswer = answer.toLowerCase().trim();
    
    // 🆕 Normalizza: rimuovi accenti e caratteri speciali
    const normalize = (str) => {
      return str
        .toLowerCase()
        .trim()
        .normalize("NFD") // Decompose accents
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "")
        .replace(/ï/g, "i")  // ï → i
        .replace(/ü/g, "u")  // ü → u
        .replace(/ö/g, "o")  // ö → o
        .replace(/\s+/g, " ");
    };
  
    const correctFull = currentWord.dutch.toLowerCase().trim();
    const correctBase = correctFull
      .split(",")[0]
      .replace(/^(de |het |een |het )/, "")
      .trim();
  
    // Normalizza risposte
    const normalizedAnswer = normalize(userAnswer);
    const normalizedFull = normalize(correctFull);
    const normalizedBase = normalize(correctBase);
    const normalizedWithDe = normalize(`de ${correctBase}`);
    const normalizedWithHet = normalize(`het ${correctBase}`);
  
    // Accetta varianti normalizzate
    const isCorrect =
      normalizedAnswer === normalizedFull ||
      normalizedAnswer === normalizedBase ||
      normalizedAnswer === normalizedWithDe ||
      normalizedAnswer === normalizedWithHet;
  
  

    let newScore = score;
    let newStreak = streak;
    let newLives = lives;

    if (isCorrect) {
      newScore += 10;
      newStreak += 1;
      if (newStreak >= 5) {
        newScore += 10;
        newStreak = 0;
      }
      setFeedback(`✅ Correct! (+10)`);
    } else {
      newLives -= 1;
      newStreak = 0;
      setFeedback(`❌ Wrong! It's '${currentWord.dutch}'.`);
    }

    setSessionResults([
      ...sessionResults,
      {
        word: currentWord.english,
        correct: isCorrect,
        answer: userAnswer,
      },
    ]);

    setScore(newScore);
    setLives(newLives);
    setStreak(newStreak);
    setAnswer("");

    if (newLives <= 0 || currentIndex >= words.length - 1) {
      setGameOver(true);
    } else {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setFeedback("");
      }, 2000);
    }
  };

  const startNewSession = () => {
    setCurrentIndex(0);
    setAnswer("");
    setFeedback("");
    setScore(0);
    setLives(5);
    setStreak(0);
    setGameOver(false);
    setSessionResults([]);
  };

  const saveSession = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user.id;
      const correctCount = sessionResults.filter((r) => r.correct).length;
      const bonus100 = correctCount === words.length ? 50 : 0;
      const finalScore = score + bonus100;

      // Save session
      const { error: sessionError } = await supabase.from("sessions").insert([
        {
          user_id: userId,
          score: finalScore,
          correct_answers: correctCount,
          total_words: words.length,
          ended_at: new Date(),
        },
      ]);

      if (sessionError) throw sessionError;

      // Save progress for each word
      for (const result of sessionResults) {
        const word = words.find((w) => w.english === result.word);
        if (!word) continue;

        const { data: existingProgress } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", userId)
          .eq("word_id", word.id)
          .single();

        if (existingProgress) {
          const newCorrectCount =
            existingProgress.correct_count + (result.correct ? 1 : 0);
          const newIncorrectCount =
            existingProgress.incorrect_count + (result.correct ? 0 : 1);
          const isMastered = newCorrectCount >= 10;

          await supabase
            .from("user_progress")
            .update({
              correct_count: newCorrectCount,
              incorrect_count: newIncorrectCount,
              mastered: isMastered,
              last_seen_at: new Date(),
            })
            .eq("id", existingProgress.id);
        } else {
          await supabase.from("user_progress").insert([
            {
              user_id: userId,
              word_id: word.id,
              correct_count: result.correct ? 1 : 0,
              incorrect_count: result.correct ? 0 : 1,
              mastered: false,
              last_seen_at: new Date(),
            },
          ]);
        }
      }

      alert("Session saved!");
    } catch (error) {
      console.error("Error saving session:", error);
      alert("Failed to save session.");
    }
  };

  if (gameOver) {
    const correctCount = sessionResults.filter((r) => r.correct).length;
    const bonus100 = correctCount === words.length ? 50 : 0;
    const finalScore = score + bonus100;

    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h1>🎮 Session Complete!</h1>
        <div style={{ fontSize: "24px", margin: "20px 0" }}>
          <p>Score: <strong>{finalScore}</strong></p>
          <p>Correct: {correctCount}/{words.length}</p>
          <p>Lives left: {lives}</p>
          {bonus100 > 0 && <p>🏆 Perfect Bonus: +{bonus100}</p>}
        </div>
        <button
          onClick={saveSession}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            margin: "10px",
            backgroundColor: "#4CAF50",
            color: "white",
          }}
        >
          Save Session
        </button>
        <button
          onClick={startNewSession}
          style={{ padding: "10px 20px", fontSize: "16px", margin: "10px" }}
        >
          New Session
        </button>
        <button onClick={goBack}>Back to Menu</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h1>Play Mode - Level {userLevel}</h1>

      <div style={{ marginBottom: "30px", fontSize: "18px" }}>
        <p>
          <strong>Word {currentIndex + 1}/{words.length}:</strong> {currentWord.category}
        </p>
        <p>Score: {score} | Lives: {lives}/5 | Streak: {streak}</p>
      </div>

      <div style={{ fontSize: "28px", marginBottom: "20px" }}>
        Translate to Dutch: <strong>{currentWord.english}</strong>
      </div>

      {currentWord.example_nl && (
        <div
          style={{
            backgroundColor: "#f0f0f0",
            padding: "10px",
            borderRadius: "5px",
            marginBottom: "20px",
            fontSize: "14px",
          }}
        >
          <p style={{ margin: "5px 0", fontStyle: "italic", color: "#333" }}>
            <strong>Dutch:</strong> {currentWord.example_nl}
          </p>
          {currentWord.example_en && (
            <p style={{ margin: "5px 0", color: "#666" }}>
              <strong>English:</strong> {currentWord.example_en}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type Dutch translation"
          style={{
            padding: "12px",
            fontSize: "18px",
            width: "300px",
            marginRight: "10px",
          }}
          disabled={gameOver}
          autoFocus
        />
        <button type="submit" disabled={gameOver}>
          Submit
        </button>
      </form>

      {feedback && (
        <p
          style={{
            fontSize: "20px",
            marginTop: "20px",
            color: feedback.includes("✅") ? "green" : "red",
          }}
        >
          {feedback}
        </p>
      )}

      <button
        onClick={goBack}
        style={{ marginTop: "30px" }}
        disabled={gameOver}
      >
        Abandon Session
      </button>
    </div>
  );
}

export default Play;
