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
  const [levelCompleted, setLevelCompleted] = useState(false);
  const [levelStats, setLevelStats] = useState({
    correctCount: 0,
    streakBonusTotal: 0,
    levelBonus: 0,
  });

  const QUESTIONS_PER_LEVEL = 10;

  // Funzione per riprodurre suoni
  const playSound = (type) => {
    const soundEnabled = localStorage.getItem("soundEnabled") !== "false";
    const volume = parseFloat(localStorage.getItem("volume")) || 70;

    if (!soundEnabled) return;

    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      gain.gain.value = volume / 100;

      if (type === "correct") {
        osc.frequency.setValueAtTime(523.25, audioContext.currentTime);
        osc.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
      } else if (type === "wrong") {
        osc.frequency.setValueAtTime(400, audioContext.currentTime);
        osc.frequency.setValueAtTime(300, audioContext.currentTime + 0.1);
        osc.frequency.setValueAtTime(200, audioContext.currentTime + 0.2);
        gain.gain.setValueAtTime(volume / 100, audioContext.currentTime);
        gain.gain.setValueAtTime(0, audioContext.currentTime + 0.3);
      } else if (type === "bonus") {
        osc.frequency.setValueAtTime(800, audioContext.currentTime);
        osc.frequency.setValueAtTime(900, audioContext.currentTime + 0.15);
        osc.frequency.setValueAtTime(1000, audioContext.currentTime + 0.3);
      } else if (type === "levelup") {
        // Suono level up celebrativo
        osc.frequency.setValueAtTime(523.25, audioContext.currentTime);
        osc.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
        osc.frequency.setValueAtTime(1046.5, audioContext.currentTime + 0.3);
      }
      osc.start();
      osc.stop(audioContext.currentTime + 0.4);
    } catch (e) {}
  };

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
        <h1 style={styles.loadingText}>Loading...</h1>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <h1 style={styles.loadingText}>No words available</h1>
        <button onClick={goBack} style={styles.primaryButton}>
          Back to Menu
        </button>
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
    let streakBonusThisRound = 0;

    const wordPoints = currentWord.difficulty || 1;

    if (isCorrect) {
      playSound("correct");
      newScore += wordPoints;
      newStreak += 1;

      // Streak bonus: guadagna punti = numero della streak
      streakBonusThisRound = newStreak;
      newScore += streakBonusThisRound;

      setFeedback(
        `✅ Correct! +${wordPoints} pts${streakBonusThisRound > 0 ? ` +${streakBonusThisRound} streak` : ""}`
      );

      // Play bonus sound per ogni 3 di streak
      if (newStreak % 3 === 0) {
        setTimeout(() => playSound("bonus"), 200);
      }
    } else {
      playSound("wrong");
      newLives -= 1;
      newStreak = 0;
      setFeedback(`❌ Wrong! The answer is '${currentWord.dutch}'.`);
    }

    const newUsedWords = new Set(usedWordIds);
    newUsedWords.add(currentWord.id);
    setUsedWordIds(newUsedWords);

    const newSessionResult = {
      word: currentWord.english,
      dutch: currentWord.dutch,
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

    // Aggiorna stats per il livello
    if (isCorrect) {
      setLevelStats((prev) => ({
        ...prev,
        correctCount: prev.correctCount + 1,
        streakBonusTotal: prev.streakBonusTotal + streakBonusThisRound,
      }));
    }

    if (newLives <= 0) {
      setTimeout(() => {
        saveSessionAuto(newScore + totalSessionScore, allSessionResults);
        setGameOver(true);
      }, 2000);
    } else if (newQuestionsInLevel >= QUESTIONS_PER_LEVEL) {
      setTimeout(() => {
        nextLevel(newScore, newQuestionsInLevel);
      }, 2000);
    } else if (currentIndex >= words.length - 1) {
      setTimeout(() => {
        nextLevel(newScore, newQuestionsInLevel);
      }, 2000);
    } else {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setFeedback("");
      }, 2000);
    }
  };

  const nextLevel = async (levelScore, totalQuestionsInLevel) => {
    const nextLevelNumber = currentLevel + 1;
    const levelBonus = nextLevelNumber * 10; // Livello bonus

    setLevelStats((prev) => ({
      ...prev,
      levelBonus,
    }));

    if (nextLevelNumber > 100) {
      setTotalSessionScore(totalSessionScore + levelScore + levelBonus);
      setGameOver(true);
      setLevelCompleted(false);
      return;
    }

    playSound("levelup");
    setLevelCompleted(true);
  };

  const proceedToNextLevel = async () => {
    const nextLevelNumber = currentLevel + 1;

    if (nextLevelNumber > 100) {
      setGameOver(true);
      setLevelCompleted(false);
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
      setTotalSessionScore(
        totalSessionScore + levelStats.correctCount * (currentLevel) + levelStats.streakBonusTotal + levelStats.levelBonus
      );
      setSessionResults([]);
      setLevelStats({ correctCount: 0, streakBonusTotal: 0, levelBonus: 0 });
      setLevelCompleted(false);
    } catch (error) {
      console.error("Error loading next level:", error);
      alert("Failed to load next level.");
      setGameOver(true);
      setLevelCompleted(false);
    } finally {
      setLoading(false);
    }
  };

  const saveSessionAuto = async (finalScore, results) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user.id;
      const correctCount = results.filter((r) => r.correct).length;

      const { error: sessionError } = await supabase.from("sessions").insert([
        {
          user_id: userId,
          score: finalScore,
          correct_answers: correctCount,
          total_words: results.length,
          ended_at: new Date(),
          level: currentLevel,
        },
      ]);

      if (sessionError) {
        console.error("Session save error:", sessionError);
        return;
      }

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

  const renderHearts = () => {
    const hearts = [];
    for (let i = 0; i < 5; i++) {
      hearts.push(
        <span key={i} style={styles.heart}>
          {i < lives ? "❤️" : "🩶"}
        </span>
      );
    }
    return hearts;
  };

  if (levelCompleted) {
    const correctCount = sessionResults.filter((r) => r.correct).length;
    const levelTotalScore =
      levelStats.correctCount * currentLevel +
      levelStats.streakBonusTotal +
      levelStats.levelBonus;
    const sessionTotalScore = totalSessionScore + levelTotalScore;

    return (
      <div style={styles.levelCompleteContainer}>
        <h1 style={styles.levelCompleteTitle}>🎉 Level {currentLevel} Complete!</h1>

        <div style={styles.breakdownContainer}>
          <div style={styles.breakdownRow}>
            <span style={styles.breakdownLabel}>Correct Answers</span>
            <span style={styles.breakdownValue}>
              {correctCount}/{sessionResults.length} → +
              {levelStats.correctCount * currentLevel} pts
            </span>
          </div>

          <div style={styles.breakdownRow}>
            <span style={styles.breakdownLabel}>Streak Bonuses</span>
            <span style={styles.breakdownValue}>+{levelStats.streakBonusTotal} pts</span>
          </div>

          <div style={styles.breakdownRow}>
            <span style={styles.breakdownLabel}>Level Bonus</span>
            <span style={styles.breakdownValue}>+{levelStats.levelBonus} pts</span>
          </div>

          <div style={styles.breakdownDivider} />

          <div style={styles.breakdownRow}>
            <span style={styles.breakdownLabel}>Level Total</span>
            <span style={styles.breakdownValueTotal}>+{levelTotalScore} pts</span>
          </div>

          <div style={styles.breakdownRow}>
            <span style={styles.breakdownLabel}>Session Total</span>
            <span style={styles.breakdownValueSession}>{sessionTotalScore} pts</span>
          </div>
        </div>

        <button
          onClick={proceedToNextLevel}
          style={styles.primaryButton}
        >
          Next Level →
        </button>
      </div>
    );
  }

  if (gameOver) {
    const correctCount = allSessionResults.filter((r) => r.correct).length;
    const finalScore = totalSessionScore;
    const accuracy =
      allSessionResults.length > 0
        ? Math.round((correctCount / allSessionResults.length) * 100)
        : 0;

    // Missed words da TUTTA la sessione
    const missedWords = allSessionResults
      .filter((r) => !r.correct)
      .reduce((acc, result) => {
        const existing = acc.find((item) => item.word === result.word);
        if (!existing) {
          acc.push({
            word: result.word,
            dutch: result.dutch,
            attempts: 1,
          });
        } else {
          existing.attempts += 1;
        }
        return acc;
      }, [])
      .sort((a, b) => b.attempts - a.attempts);

    return (
      <div style={styles.gameOverContainer}>
        <div style={styles.header}>
          <h1 style={styles.gameOverTitle}>Game Over</h1>
          <button
            onClick={goBack}
            style={styles.backButtonGameOver}
          >
            ← Menu
          </button>
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <p style={styles.statValue}>{finalScore}</p>
            <p style={styles.statLabel}>Final Score</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statValue}>{currentLevel}</p>
            <p style={styles.statLabel}>Levels</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statValue}>{accuracy}%</p>
            <p style={styles.statLabel}>Accuracy</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statValue}>
              {correctCount}/{allSessionResults.length}
            </p>
            <p style={styles.statLabel}>Correct</p>
          </div>
        </div>

        {missedWords.length > 0 && (
          <div style={styles.missedWordsContainer}>
            <h2 style={styles.missedWordsTitle}>📝 Words to Review</h2>
            <div style={styles.missedWordsList}>
              {missedWords.slice(0, 10).map((item, idx) => (
                <div key={idx} style={styles.missedWordItem}>
                  <span style={styles.missedWordEnglish}>{item.word}</span>
                  <span style={styles.missedWordDutch}>{item.dutch}</span>
                  {item.attempts > 1 && (
                    <span style={styles.attemptsBadge}>{item.attempts}x</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
        <h1 style={styles.title}>Level {currentLevel}</h1>
        <div style={styles.headerRight}>
          <div style={styles.livesContainer}>{renderHearts()}</div>
          <button onClick={goBack} style={styles.backButton}>
            ← Menu
          </button>
        </div>
      </div>

      <div style={styles.progressBar}>
        <div
          style={{
            ...styles.progressFill,
            width: `${(questionsInLevel / QUESTIONS_PER_LEVEL) * 100}%`,
          }}
        />
      </div>

      <div style={styles.stats}>
        <div style={styles.statItem}>
          <span>📊</span> {totalSessionScore + score}
        </div>
        <div style={styles.statItem}>
          <span>🔥</span> {streak}
        </div>
      </div>

      <div style={styles.questionContainer}>
        <p style={styles.questionLabel}>
          Q{questionsInLevel + 1}/{QUESTIONS_PER_LEVEL}
        </p>
        <h2 style={styles.questionText}>Translate to Dutch:</h2>
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
          placeholder="Type the translation..."
          style={styles.input}
          disabled={gameOver}
          autoFocus
        />
        <button type="submit" style={styles.submitButton} disabled={gameOver}>
          Submit
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
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    padding: "16px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    gap: "12px",
  },
  title: {
    fontSize: "clamp(20px, 5vw, 28px)",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0",
    flex: 1,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  livesContainer: {
    display: "flex",
    gap: "2px",
    fontSize: "clamp(16px, 4vw, 20px)",
    flexShrink: 0,
  },
  heart: {
    display: "inline-block",
  },
  backButton: {
    padding: "6px 12px",
    fontSize: "clamp(11px, 2.5vw, 13px)",
    background: "#06b6d4",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  progressBar: {
    height: "6px",
    background: "#e5e7eb",
    borderRadius: "8px",
    overflow: "hidden",
    marginBottom: "12px",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
    transition: "width 0.3s ease",
  },
  stats: {
    display: "flex",
    justifyContent: "center",
    gap: "24px",
    marginBottom: "16px",
    fontSize: "clamp(12px, 3vw, 14px)",
  },
  statItem: {
    color: "#475569",
    fontWeight: "600",
  },
  questionContainer: {
    textAlign: "center",
    marginBottom: "16px",
  },
  questionLabel: {
    fontSize: "clamp(11px, 2.5vw, 12px)",
    color: "#64748b",
    margin: "0 0 6px 0",
  },
  questionText: {
    fontSize: "clamp(12px, 2.5vw, 14px)",
    color: "#64748b",
    margin: "0 0 8px 0",
    fontWeight: "500",
  },
  wordToTranslate: {
    fontSize: "clamp(24px, 6vw, 36px)",
    color: "#1e293b",
    margin: "0",
    fontWeight: "700",
    wordBreak: "break-word",
  },
  exampleBox: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    fontSize: "clamp(11px, 2.5vw, 13px)",
  },
  exampleNL: {
    color: "#475569",
    margin: "0 0 6px 0",
  },
  exampleEN: {
    color: "#64748b",
    margin: "0",
    fontSize: "clamp(10px, 2.5vw, 12px)",
  },
  form: {
    display: "flex",
    gap: "6px",
    marginBottom: "12px",
  },
  input: {
    padding: "8px 10px",
    fontSize: "clamp(13px, 3vw, 14px)",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    flex: 1,
    minWidth: "120px",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
  },
  submitButton: {
    padding: "8px 16px",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 6px rgba(59, 130, 246, 0.2)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  feedback: {
    fontSize: "clamp(13px, 3vw, 15px)",
    fontWeight: "600",
    margin: "12px 0",
    minHeight: "24px",
    textAlign: "center",
  },
  // Level Complete Screen
  levelCompleteContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  levelCompleteTitle: {
    fontSize: "clamp(28px, 6vw, 40px)",
    color: "#1e293b",
    margin: "0 0 20px 0",
    textAlign: "center",
  },
  breakdownContainer: {
    background: "white",
    border: "2px solid #e5e7eb",
    borderRadius: "12px",
    padding: "16px",
    maxWidth: "400px",
    marginBottom: "20px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    fontSize: "clamp(13px, 2.5vw, 14px)",
    fontWeight: "500",
  },
  breakdownLabel: {
    color: "#475569",
  },
  breakdownValue: {
    color: "#1e293b",
    fontWeight: "600",
  },
  breakdownValueTotal: {
    color: "#059669",
    fontWeight: "700",
    fontSize: "clamp(14px, 3vw, 16px)",
  },
  breakdownValueSession: {
    color: "#3b82f6",
    fontWeight: "700",
    fontSize: "clamp(14px, 3vw, 16px)",
  },
  breakdownDivider: {
    height: "1px",
    background: "#e5e7eb",
    margin: "8px 0",
  },
  // Game Over Screen
  gameOverContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    display: "flex",
    flexDirection: "column",
    padding: "16px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  gameOverTitle: {
    fontSize: "clamp(24px, 6vw, 36px)",
    color: "#1e293b",
    margin: "0",
    textAlign: "center",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
    maxWidth: "500px",
    margin: "20px auto",
    width: "100%",
  },
  statCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "12px",
    textAlign: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
  },
  statValue: {
    fontSize: "clamp(20px, 4vw, 28px)",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0 0 4px 0",
  },
  statLabel: {
    fontSize: "clamp(11px, 2vw, 12px)",
    color: "#64748b",
    margin: "0",
    fontWeight: "600",
  },
  missedWordsContainer: {
    background: "white",
    border: "1px solid #fca5a5",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "16px",
    maxWidth: "500px",
    margin: "0 auto 16px",
    width: "100%",
  },
  missedWordsTitle: {
    fontSize: "clamp(13px, 2.5vw, 14px)",
    color: "#991b1b",
    margin: "0 0 12px 0",
    fontWeight: "600",
  },
  missedWordsList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  missedWordItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "clamp(11px, 2.5vw, 12px)",
    padding: "8px",
    background: "#fef2f2",
    borderRadius: "6px",
    gap: "8px",
  },
  missedWordEnglish: {
    fontWeight: "600",
    color: "#1e293b",
    minWidth: "80px",
  },
  missedWordDutch: {
    color: "#64748b",
    flex: 1,
    textAlign: "right",
  },
  attemptsBadge: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "2px 6px",
    borderRadius: "4px",
    fontWeight: "600",
    fontSize: "clamp(10px, 2vw, 11px)",
    minWidth: "28px",
    textAlign: "center",
  },
  buttonContainer: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "center",
    maxWidth: "500px",
    margin: "0 auto",
    width: "100%",
  },
  primaryButton: {
    padding: "10px 20px",
    fontSize: "clamp(12px, 2.5vw, 14px)",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
    transition: "all 0.2s ease",
    flex: "1 1 150px",
    minWidth: "120px",
  },
  secondaryButton: {
    padding: "10px 20px",
    fontSize: "clamp(12px, 2.5vw, 14px)",
    fontWeight: "600",
    background: "#f3f4f6",
    color: "#475569",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    flex: "1 1 150px",
    minWidth: "120px",
  },
  backButtonGameOver: {
    padding: "8px 14px",
    fontSize: "clamp(11px, 2.5vw, 12px)",
    background: "#06b6d4",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "20px",
  },
  loadingText: {
    fontSize: "clamp(20px, 5vw, 28px)",
    color: "#1e293b",
    margin: "0",
  },
};

export default Play;
