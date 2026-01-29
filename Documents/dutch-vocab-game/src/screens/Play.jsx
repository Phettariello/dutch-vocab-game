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
  const [allUsedWordIds, setAllUsedWordIds] = useState(new Set());
  const [questionsInLevel, setQuestionsInLevel] = useState(0);
  const [levelCompleted, setLevelCompleted] = useState(false);
  const [levelStats, setLevelStats] = useState({
    correctCount: 0,
    streakBonusTotal: 0,
    levelBonus: 0,
  });

  const QUESTIONS_PER_LEVEL = 10;

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
      // Difficulty based on level: 1-10 use 1-3, 11+ use any (1-10)
      let maxDifficulty = 3;
      if (levelNumber >= 11) {
        maxDifficulty = 10;
      }

      console.log(
        `[Level ${levelNumber}] Fetching words with difficulty <= ${maxDifficulty}`
      );
      console.log(
        `[Level ${levelNumber}] Already used globally: ${allUsedWordIds.size} words`
      );

      const { data, error } = await supabase
        .from("words")
        .select("*")
        .lte("difficulty", maxDifficulty);

      if (error) throw error;

      if (!data || data.length === 0) {
        console.error("No words available in database");
        throw new Error("No words available");
      }

      const availableWords = data.filter(
        (w) => !allUsedWordIds.has(w.id) && !usedWordIds.has(w.id)
      );

      console.log(
        `[Level ${levelNumber}] Available (not used): ${availableWords.length} words`
      );

      if (availableWords.length < QUESTIONS_PER_LEVEL) {
        console.warn(
          `[Level ${levelNumber}] Only ${availableWords.length} unique words available, need ${QUESTIONS_PER_LEVEL}`
        );
      }

      const shuffled = availableWords.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, QUESTIONS_PER_LEVEL);
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

      streakBonusThisRound = newStreak;
      newScore += streakBonusThisRound;

      setFeedback(
        `✅ Correct! +${wordPoints} pts${
          streakBonusThisRound > 0 ? ` +${streakBonusThisRound} streak` : ""
        }`
      );

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

    const newAllUsedWords = new Set(allUsedWordIds);
    newAllUsedWords.add(currentWord.id);
    setAllUsedWordIds(newAllUsedWords);

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
        const nextIndex = currentIndex + 1;
        if (nextIndex < words.length) {
          if (words[nextIndex].id === currentWord.id) {
            let findIndex = nextIndex + 1;
            while (
              findIndex < words.length &&
              words[findIndex].id === currentWord.id
            ) {
              findIndex++;
            }
            if (findIndex < words.length) {
              setCurrentIndex(findIndex);
            } else {
              setCurrentIndex(nextIndex);
            }
          } else {
            setCurrentIndex(nextIndex);
          }
        }
        setFeedback("");
      }, 2000);
    }
  };

  const nextLevel = async (levelScore, totalQuestionsInLevel) => {
    const nextLevelNumber = currentLevel + 1;
    const levelBonus = currentLevel * 10;

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
      setUsedWordIds(new Set());
      setTotalSessionScore(
        totalSessionScore +
          levelStats.correctCount * currentLevel +
          levelStats.streakBonusTotal +
          levelStats.levelBonus
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

        const correctCountWord = correctArray.filter((c) => c).length;
        const incorrectCount = correctArray.filter((c) => !c).length;

        const { data: existingProgress, error: fetchError } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", userId)
          .eq("word_id", word.id)
          .maybeSingle();

        if (fetchError && fetchError.code !== "PGRST116") {
          console.error("Fetch error:", fetchError);
          continue;
        }

        if (existingProgress) {
          const newCorrectCount =
            existingProgress.correct_count + correctCountWord;
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
              correct_count: correctCountWord,
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
        <h1 style={styles.levelCompleteTitle}>
          🎉 Level {currentLevel} Complete!
        </h1>

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
            <span style={styles.breakdownValue}>
              +{levelStats.streakBonusTotal} pts
            </span>
          </div>

          <div style={styles.breakdownRow}>
            <span style={styles.breakdownLabel}>Level Bonus</span>
            <span style={styles.breakdownValue}>
              +{levelStats.levelBonus} pts
            </span>
          </div>

          <div style={styles.breakdownDivider} />

          <div style={styles.breakdownRow}>
            <span style={styles.breakdownLabel}>Level Total</span>
            <span style={styles.breakdownValueTotal}>
              +{levelTotalScore} pts
            </span>
          </div>

          <div style={styles.breakdownRow}>
            <span style={styles.breakdownLabel}>Game Total</span>
            <span style={styles.breakdownValueSession}>
              {sessionTotalScore} pts
            </span>
          </div>
        </div>

        <button onClick={proceedToNextLevel} style={styles.nextLevelButton}>
          Next →
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

    const missedWordsMap = new Map();
    allSessionResults
      .filter((r) => !r.correct)
      .forEach((result) => {
        if (!missedWordsMap.has(result.word)) {
          missedWordsMap.set(result.word, {
            word: result.word,
            dutch: result.dutch,
            attempts: 0,
            correct: 0,
            incorrect: 0,
          });
        }
        const item = missedWordsMap.get(result.word);
        item.attempts += 1;
        item.incorrect += 1;
      });

    allSessionResults
      .filter((r) => r.correct)
      .forEach((result) => {
        if (missedWordsMap.has(result.word)) {
          const item = missedWordsMap.get(result.word);
          item.correct += 1;
        }
      });

    const missedWords = Array.from(missedWordsMap.values()).sort(
      (a, b) => b.attempts - a.attempts
    );

    return (
      <div style={styles.gameOverContainer}>
        <div style={styles.gameOverHeader}>
          <h1 style={styles.gameOverTitle}>Game Over</h1>
          <button onClick={goBack} style={styles.backButtonGameOver}>
            ← Menu
          </button>
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <p style={styles.statValue}>{finalScore}</p>
            <p style={styles.statLabel}>Score</p>
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
          <div style={styles.missedWordsSection}>
            <h2 style={styles.missedWordsTitle}>📝 Missed Words</h2>
            <div style={styles.missedWordsTable}>
              {missedWords.slice(0, 10).map((item, idx) => {
                const total = item.correct + item.incorrect;
                const masteryPercent =
                  total > 0 ? Math.round((item.correct / total) * 100) : 0;

                return (
                  <div key={idx} style={styles.missedWordRow}>
                    <div style={styles.missedWordLeft}>
                      <span style={styles.missedWordEnglish}>{item.word}</span>
                      <span style={styles.missedWordDutch}>{item.dutch}</span>
                    </div>
                    <span
                      style={{
                        ...styles.masteryBadge,
                        backgroundColor:
                          masteryPercent >= 60
                            ? "#22c55e"
                            : masteryPercent >= 30
                            ? "#f97316"
                            : "#ef4444",
                      }}
                    >
                      {masteryPercent}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={styles.buttonContainer}>
          <button onClick={startNewGame} style={styles.primaryButton}>
            🎮 New Game
          </button>
          <button onClick={goBack} style={styles.secondaryButton}>
            ← Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🎮 Level {currentLevel}</h1>
        <div style={styles.headerRight}>
          <div style={styles.livesContainer}>{renderHearts()}</div>
          <button
            onClick={goBack}
            style={styles.backButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#0891b2";
              e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#06b6d4";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
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
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    padding: "0",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(6,182,212,0.2)",
    gap: "12px",
  },
  title: {
    fontSize: "clamp(20px, 5vw, 28px)",
    fontWeight: "800",
    margin: "0",
    color: "white",
    textShadow: "0 2px 8px rgba(6,182,212,0.3)",
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
    padding: "8px 12px",
    fontSize: "clamp(11px, 2.5vw, 12px)",
    background: "#06b6d4",
    color: "#0f172a",
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
    background: "rgba(6,182,212,0.2)",
    borderRadius: "8px",
    overflow: "hidden",
    margin: "12px 20px 0",
    maxWidth: "calc(100% - 40px)",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
    transition: "width 0.3s ease",
  },
  stats: {
    display: "flex",
    justifyContent: "center",
    gap: "32px",
    padding: "16px 20px",
    fontSize: "clamp(12px, 3vw, 14px)",
  },
  statItem: {
    color: "#bfdbfe",
    fontWeight: "600",
  },
  questionContainer: {
    textAlign: "center",
    padding: "0 20px",
    marginBottom: "16px",
  },
  questionLabel: {
    fontSize: "clamp(11px, 2.5vw, 12px)",
    color: "#93c5fd",
    margin: "0 0 6px 0",
  },
  questionText: {
    fontSize: "clamp(12px, 2.5vw, 13px)",
    color: "#bfdbfe",
    margin: "0 0 8px 0",
    fontWeight: "500",
  },
  wordToTranslate: {
    fontSize: "clamp(28px, 7vw, 40px)",
    color: "white",
    margin: "0",
    fontWeight: "700",
    wordBreak: "break-word",
  },
  exampleBox: {
    background: "rgba(30, 58, 138, 0.6)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "8px",
    padding: "12px",
    margin: "0 20px 16px",
    fontSize: "clamp(11px, 2.5vw, 12px)",
  },
  exampleNL: {
    color: "#93c5fd",
    margin: "0 0 6px 0",
  },
  exampleEN: {
    color: "#cbd5e1",
    margin: "0",
    fontSize: "clamp(10px, 2.5vw, 11px)",
  },
  form: {
    display: "flex",
    gap: "8px",
    padding: "0 20px 12px",
  },
  input: {
    padding: "10px 12px",
    fontSize: "clamp(13px, 3vw, 14px)",
    border: "1px solid rgba(6,182,212,0.4)",
    borderRadius: "6px",
    flex: 1,
    minWidth: "120px",
    background: "rgba(255,255,255,0.95)",
    color: "#0f172a",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
  },
  submitButton: {
    padding: "10px 16px",
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
    fontSize: "clamp(13px, 3vw, 14px)",
    fontWeight: "600",
    margin: "12px 20px 0",
    minHeight: "24px",
    textAlign: "center",
    color: "#10b981",
  },
  levelCompleteContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  levelCompleteTitle: {
    fontSize: "clamp(28px, 6vw, 40px)",
    color: "white",
    margin: "0 0 20px 0",
    textAlign: "center",
  },
  breakdownContainer: {
    background: "rgba(30, 58, 138, 0.8)",
    border: "1px solid rgba(6,182,212,0.2)",
    borderRadius: "12px",
    padding: "16px",
    maxWidth: "360px",
    marginBottom: "20px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  },
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    fontWeight: "500",
  },
  breakdownLabel: {
    color: "#bfdbfe",
  },
  breakdownValue: {
    color: "#f0f9ff",
    fontWeight: "600",
  },
  breakdownValueTotal: {
    color: "#22c55e",
    fontWeight: "700",
    fontSize: "clamp(13px, 3vw, 14px)",
  },
  breakdownValueSession: {
    color: "#fbbf24",
    fontWeight: "700",
    fontSize: "clamp(13px, 3vw, 14px)",
  },
  breakdownDivider: {
    height: "1px",
    background: "rgba(6,182,212,0.2)",
    margin: "8px 0",
  },
  nextLevelButton: {
    padding: "12px 24px",
    fontSize: "clamp(13px, 2.5vw, 14px)",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
  },
  gameOverContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    display: "flex",
    flexDirection: "column",
    padding: "16px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    overflowY: "auto",
  },
  gameOverHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    gap: "12px",
  },
  gameOverTitle: {
    fontSize: "clamp(24px, 6vw, 36px)",
    color: "white",
    margin: "0",
    flex: 1,
  },
  backButtonGameOver: {
    padding: "8px 12px",
    fontSize: "clamp(11px, 2.5vw, 12px)",
    background: "#06b6d4",
    color: "#0f172a",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
    maxWidth: "400px",
    margin: "0 auto 16px",
    width: "100%",
  },
  statCard: {
    background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
    border: "1px solid rgba(6,182,212,0.2)",
    borderRadius: "10px",
    padding: "14px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  statValue: {
    fontSize: "clamp(20px, 4vw, 28px)",
    fontWeight: "700",
    color: "#fbbf24",
    margin: "0 0 4px 0",
  },
  statLabel: {
    fontSize: "clamp(10px, 2vw, 11px)",
    color: "#bfdbfe",
    margin: "0",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  missedWordsSection: {
    background: "rgba(30, 58, 138, 0.6)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "16px",
    maxWidth: "450px",
    margin: "0 auto 16px",
    width: "100%",
  },
  missedWordsTitle: {
    fontSize: "clamp(13px, 2.5vw, 14px)",
    color: "#fca5a5",
    margin: "0 0 12px 0",
    fontWeight: "600",
  },
  missedWordsTable: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  missedWordRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "clamp(11px, 2.5vw, 12px)",
    padding: "10px",
    background: "rgba(30, 58, 138, 0.8)",
    borderRadius: "6px",
    gap: "8px",
    border: "1px solid rgba(6,182,212,0.2)",
  },
  missedWordLeft: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    gap: "2px",
  },
  missedWordEnglish: {
    fontWeight: "600",
    color: "white",
  },
  missedWordDutch: {
    color: "#93c5fd",
    fontSize: "clamp(10px, 2.5vw, 11px)",
  },
  masteryBadge: {
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "clamp(10px, 2vw, 11px)",
    fontWeight: "bold",
    color: "white",
    minWidth: "40px",
    textAlign: "center",
    flexShrink: 0,
  },
  buttonContainer: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "center",
    maxWidth: "450px",
    margin: "0 auto",
    width: "100%",
  },
  primaryButton: {
    padding: "12px 20px",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    fontWeight: "600",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
    transition: "all 0.2s ease",
    flex: "1 1 140px",
    minWidth: "120px",
  },
  secondaryButton: {
    padding: "12px 20px",
    fontSize: "clamp(12px, 2.5vw, 13px)",
    fontWeight: "600",
    background: "rgba(255,255,255,0.1)",
    color: "#06b6d4",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    flex: "1 1 140px",
    minWidth: "120px",
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "20px",
  },
  loadingText: {
    fontSize: "clamp(20px, 5vw, 28px)",
    color: "white",
    margin: "0",
  },
};

export default Play;