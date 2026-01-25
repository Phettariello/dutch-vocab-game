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
  const [currentLevel, setCurrentLevel] = useState(1);
  const [totalSessionScore, setTotalSessionScore] = useState(0);
  const [allSessionResults, setAllSessionResults] = useState([]);
  const [usedWordIds, setUsedWordIds] = useState(new Set());
  const [questionsInLevel, setQuestionsInLevel] = useState(0);

  const QUESTIONS_PER_LEVEL = 10;

  const fetchWordsForLevel = async (levelNumber) => {
    try {
      let maxDifficulty = 3;
      if (levelNumber >= 61) {
        maxDifficulty = 10;
      } else if (levelNumber >= 31) {
        maxDifficulty = 7;
      } else if (levelNumber >= 11) {
        maxDifficulty = 5;
      }

      const randomOffset = Math.floor(Math.random() * 50);

      let { data, error } = await supabase
        .from("words")
        .select("*")
        .lte("difficulty", maxDifficulty)
        .range(randomOffset, randomOffset + 9);

      if (error) throw error;

      if (!data || data.length < 10) {
        const { data: allData, error: allError } = await supabase
          .from("words")
          .select("*")
          .lte("difficulty", maxDifficulty)
          .limit(10);

        if (allError) throw allError;
        data = allData;
      }

      // Filtra parole già usate
      const availableWords = data.filter((w) => !usedWordIds.has(w.id));
      const shuffled = availableWords.sort(() => Math.random() - 0.5);

      return shuffled.length > 0 ? shuffled : data.sort(() => Math.random() - 0.5);
    } catch (error) {
      console.error("Error fetching words:", error);
      throw error;
    }
  };

  useEffect(() => {
    const initializeGame = async () => {
      setLoading(true);
      try {
        const firstLevelWords = await fetchWordsForLevel(1);
        setWords(firstLevelWords);
        setCurrentLevel(1);
        setQuestionsInLevel(0);
      } catch (error) {
        console.error("Error initializing game:", error);
        alert("Failed to load words.");
        goBack();
      } finally {
        setLoading(false);
      }
    };

    initializeGame();
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <h1>Loading...</h1>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <h1>No words available</h1>
        <button onClick={goBack}>Back to Menu</button>
      </div>
    );
  }

  const currentWord = words[currentIndex];

  const handleSubmit = (e) => {
    e.preventDefault();
    const userAnswer = answer.toLowerCase().trim();

    const normalize = (str) => {
      return str
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "")
        .replace(/ï/g, "i")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/\s+/g, " ");
    };

    const correctFull = currentWord.dutch.toLowerCase().trim();
    const correctBase = correctFull
      .split(",")[0]
      .replace(/^(de |het |een |het )/, "")
      .trim();

    const normalizedAnswer = normalize(userAnswer);
    const normalizedFull = normalize(correctFull);
    const normalizedBase = normalize(correctBase);
    const normalizedWithDe = normalize(`de ${correctBase}`);
    const normalizedWithHet = normalize(`het ${correctBase}`);

    const isCorrect =
      normalizedAnswer === normalizedFull ||
      normalizedAnswer === normalizedBase ||
      normalizedAnswer === normalizedWithDe ||
      normalizedAnswer === normalizedWithHet;

    let newScore = score;
    let newStreak = streak;
    let newLives = lives;

    const wordPoints = currentWord.difficulty || 1;

    if (isCorrect) {
      newScore += wordPoints;
      newStreak += 1;
      if (newStreak >= 5) {
        newScore += 10;
        newStreak = 0;
      }
      setFeedback(`✅ Correct! (+${wordPoints})`);
    } else {
      newLives -= 1;
      newStreak = 0;
      setFeedback(`❌ Wrong! It's '${currentWord.dutch}'.`);
    }

    const newUsedWords = new Set(usedWordIds);
    newUsedWords.add(currentWord.id);
    setUsedWordIds(newUsedWords);

    const newSessionResult = {
      word: currentWord.english,
      correct: isCorrect,
      answer: userAnswer,
      level: currentLevel,
    };

    setSessionResults([...sessionResults, newSessionResult]);
    setAllSessionResults([...allSessionResults, newSessionResult]);
    setScore(newScore);
    setLives(newLives);
    setStreak(newStreak);
    setAnswer("");

    const newQuestionsInLevel = questionsInLevel + 1;
    setQuestionsInLevel(newQuestionsInLevel);

    if (newLives <= 0) {
      setTimeout(() => {
        saveSessionAuto(newScore + totalSessionScore, allSessionResults);
        setGameOver(true);
      }, 2000);
    } else if (newQuestionsInLevel >= QUESTIONS_PER_LEVEL) {
      // Fine del livello, vai al prossimo
      setTimeout(() => {
        nextLevel(newScore);
      }, 2000);
    } else if (currentIndex >= words.length - 1) {
      // Fine delle parole disponibili
      setTimeout(() => {
        nextLevel(newScore);
      }, 2000);
    } else {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setFeedback("");
      }, 2000);
    }
  };

  const nextLevel = async (levelScore) => {
    const nextLevelNumber = currentLevel + 1;

    if (nextLevelNumber > 100) {
      setTotalSessionScore(totalSessionScore + levelScore);
      setGameOver(true);
      return;
    }

    try {
      setLoading(true);
      const nextLevelWords = await fetchWordsForLevel(nextLevelNumber);
      setWords(nextLevelWords);
      setCurrentLevel(nextLevelNumber);
      setCurrentIndex(0);
      setAnswer("");
      setFeedback("");
      setScore(0);
      setStreak(0);
      setQuestionsInLevel(0);
      setTotalSessionScore(totalSessionScore + levelScore);
      setSessionResults([]);
    } catch (error) {
      console.error("Error loading next level:", error);
      alert("Failed to load next level.");
      setGameOver(true);
    } finally {
      setLoading(false);
    }
  };

  const saveSessionAuto = async (finalScore, results) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user.id;
      const correctCount = results.filter((r) => r.correct).length;

      // Save session
      const { error: sessionError } = await supabase.from("sessions").insert([
        {
          user_id: userId,
          score: finalScore,
          correct_answers: correctCount,
          total_words: results.length,
          level: currentLevel,
          ended_at: new Date(),
        },
      ]);

      if (sessionError) {
        console.error("Session save error:", sessionError);
        return;
      }

      // Save progress for each unique word
      const uniqueWords = new Map();
      for (const result of results) {
        if (!uniqueWords.has(result.word)) {
          uniqueWords.set(result.word, []);
        }
        uniqueWords.get(result.word).push(result.correct);
      }

      for (const [wordEnglish, correctArray] of uniqueWords) {
        const word = words.find((w) => w.english === wordEnglish);
        if (!word) continue;

        const correctCount = correctArray.filter((c) => c).length;
        const incorrectCount = correctArray.filter((c) => !c).length;

        const { data: existingProgress, error: fetchError } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", userId)
          .eq("word_id", word.id)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          console.error("Fetch error:", fetchError);
          continue;
        }

        if (existingProgress) {
          const newCorrectCount =
            existingProgress.correct_count + correctCount;
          const newIncorrectCount =
            existingProgress.incorrect_count + incorrectCount;
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
              correct_count: correctCount,
              incorrect_count: incorrectCount,
              mastered: false,
              last_seen_at: new Date(),
            },
          ]);
        }
      }

      console.log("Session saved automatically!");
    } catch (error) {
      console.error("Error saving session:", error);
    }
  };

  const startNewGame = () => {
    window.location.reload();
  };

  if (gameOver) {
    const correctCount = allSessionResults.filter((r) => r.correct).length;
    const finalScore = totalSessionScore + score;

    return (
      <div style={styles.gameOverContainer}>
        <h1 style={styles.gameOverTitle}>🎮 Partita Terminata!</h1>
        <div style={styles.statsContainer}>
          <div style={styles.statBox}>
            <p style={styles.statLabel}>Punteggio Finale</p>
            <p style={styles.statValue}>{finalScore}</p>
          </div>
          <div style={styles.statBox}>
            <p style={styles.statLabel}>Livelli Completati</p>
            <p style={styles.statValue}>{currentLevel}</p>
          </div>
          <div style={styles.statBox}>
            <p style={styles.statLabel}>Risposte Corrette</p>
            <p style={styles.statValue}>{correctCount}/{allSessionResults.length}</p>
          </div>
        </div>
        <div style={styles.buttonContainer}>
          <button onClick={startNewGame} style={styles.primaryButton}>
            🎮 New Game
          </button>
          <button onClick={goBack} style={styles.secondaryButton}>
            ← Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Partita - Livello {currentLevel}/100</h1>
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${(questionsInLevel / QUESTIONS_PER_LEVEL) * 100}%`,
            }}
          />
        </div>
      </div>

      <div style={styles.stats}>
        <div style={styles.statItem}>
          <span>📊</span> Punti: <strong>{totalSessionScore + score}</strong>
        </div>
        <div style={styles.statItem}>
          <span>❤️</span> Vite: <strong>{lives}/5</strong>
        </div>
        <div style={styles.statItem}>
          <span>🔥</span> Serie: <strong>{streak}</strong>
        </div>
      </div>

      <div style={styles.questionContainer}>
        <p style={styles.questionLabel}>
          Domanda {currentIndex + 1}/{words.length}
        </p>
        <h2 style={styles.questionText}>Traduci in Olandese:</h2>
        <h1 style={styles.wordToTranslate}>{currentWord.english}</h1>
      </div>

      {currentWord.example_nl && (
        <div style={styles.exampleBox}>
          <p style={styles.exampleNL}>
            <strong>🇳🇱</strong> {currentWord.example_nl}
          </p>
          {currentWord.example_en && (
            <p style={styles.exampleEN}>
              <strong>🇬🇧</strong> {currentWord.example_en}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Scrivi la traduzione..."
          style={styles.input}
          disabled={gameOver}
          autoFocus
        />
        <button type="submit" style={styles.submitButton} disabled={gameOver}>
          Invia
        </button>
      </form>

      {feedback && (
        <p
          style={{
            ...styles.feedback,
            color: feedback.includes("✅") ? "#10b981" : "#ef4444",
          }}
        >
          {feedback}
        </p>
      )}

      <button onClick={goBack} style={styles.abandonButton} disabled={gameOver}>
        ← Abbandona Partita
      </button>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    padding: "40px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    textAlign: "center",
    marginBottom: "40px",
  },
  title: {
    fontSize: "32px",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0 0 20px 0",
  },
  progressBar: {
    height: "8px",
    background: "#e5e7eb",
    borderRadius: "10px",
    overflow: "hidden",
    maxWidth: "400px",
    margin: "0 auto",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
    transition: "width 0.3s ease",
  },
  stats: {
    display: "flex",
    justifyContent: "center",
    gap: "40px",
    marginBottom: "40px",
    flexWrap: "wrap",
  },
  statItem: {
    fontSize: "16px",
    color: "#475569",
    fontWeight: "500",
  },
  questionContainer: {
    textAlign: "center",
    marginBottom: "40px",
  },
  questionLabel: {
    fontSize: "14px",
    color: "#64748b",
    margin: "0 0 10px 0",
  },
  questionText: {
    fontSize: "18px",
    color: "#64748b",
    margin: "0 0 15px 0",
    fontWeight: "500",
  },
  wordToTranslate: {
    fontSize: "44px",
    color: "#1e293b",
    margin: "0",
    fontWeight: "700",
  },
  exampleBox: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "20px",
    maxWidth: "600px",
    margin: "0 auto 30px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  exampleNL: {
    fontSize: "14px",
    color: "#475569",
    margin: "0 0 10px 0",
  },
  exampleEN: {
    fontSize: "14px",
    color: "#64748b",
    margin: "0",
  },
  form: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    marginBottom: "30px",
    flexWrap: "wrap",
  },
  input: {
    padding: "12px 16px",
    fontSize: "16px",
    border: "2px solid #e5e7eb",
    borderRadius: "8px",
    width: "300px",
    transition: "all 0.3s ease",
    fontFamily: "inherit",
  },
  submitButton: {
    padding: "12px 32px",
    fontSize: "16px",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
  },
  feedback: {
    fontSize: "18px",
    fontWeight: "600",
    margin: "20px 0",
    minHeight: "30px",
  },
  abandonButton: {
    padding: "12px 24px",
    fontSize: "14px",
    background: "#f3f4f6",
    color: "#64748b",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    display: "block",
    margin: "0 auto",
  },
  gameOverContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  gameOverTitle: {
    fontSize: "48px",
    color: "#1e293b",
    margin: "0 0 40px 0",
  },
  statsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "20px",
    maxWidth: "600px",
    marginBottom: "40px",
  },
  statBox: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "24px",
    textAlign: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  statLabel: {
    fontSize: "14px",
    color: "#64748b",
    margin: "0 0 10px 0",
  },
  statValue: {
    fontSize: "32px",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0",
  },
  buttonContainer: {
    display: "flex",
    gap: "20px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  primaryButton: {
    padding: "14px 40px",
    fontSize: "16px",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
    transition: "all 0.3s ease",
  },
  secondaryButton: {
    padding: "14px 40px",
    fontSize: "16px",
    fontWeight: "600",
    background: "#f3f4f6",
    color: "#475569",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};

export default Play;
