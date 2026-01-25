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
  const [userLevel, setUserLevel] = useState(1);
  const [currentSessionLevel, setCurrentSessionLevel] = useState(1);
  const [totalSessionScore, setTotalSessionScore] = useState(0);
  const [allSessionResults, setAllSessionResults] = useState([]);
  const [usedWordIds, setUsedWordIds] = useState(new Set()); // 🆕 Traccia parole già usate

  // Carica le parole per il livello corrente
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

      // Prova con offset casuale (10 domande)
      const randomOffset = Math.floor(Math.random() * 50);

      let { data, error } = await supabase
        .from("words")
        .select("*")
        .lte("difficulty", maxDifficulty)
        .range(randomOffset, randomOffset + 9);

      if (error) throw error;

      // Se ne trovi poche, prendi senza limite di range
      if (!data || data.length < 10) {
        console.warn("Trovate solo", data?.length || 0, "parole. Prendo tutte.");
        const { data: allData, error: allError } = await supabase
          .from("words")
          .select("*")
          .lte("difficulty", maxDifficulty)
          .limit(10);

        if (allError) throw allError;
        data = allData;
      }

      // 🆕 Filtra le parole già usate e mischiale
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
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user.id;

        const { data: masteredWords } = await supabase
          .from("user_progress")
          .select("id")
          .eq("user_id", userId)
          .eq("mastered", true);

        const masteredCount = masteredWords?.length || 0;
        setUserLevel(
          masteredCount >= 50 ? 3 : masteredCount >= 20 ? 2 : 1
        );

        const firstLevelWords = await fetchWordsForLevel(1);
        setWords(firstLevelWords);
        setCurrentSessionLevel(1);
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

    // Punteggio = difficoltà della parola
    const wordPoints = currentWord.difficulty || 1;

    if (isCorrect) {
      newScore += wordPoints;
      newStreak += 1;
      if (newStreak >= 5) {
        newScore += 10; // Bonus streak
        newStreak = 0;
      }
      setFeedback(`✅ Correct! (+${wordPoints})`);
    } else {
      newLives -= 1;
      newStreak = 0;
      setFeedback(`❌ Wrong! It's '${currentWord.dutch}'.`);
    }

    // 🆕 Aggiungi la parola alle usate
    const newUsedWords = new Set(usedWordIds);
    newUsedWords.add(currentWord.id);
    setUsedWordIds(newUsedWords);

    const newSessionResult = {
      word: currentWord.english,
      correct: isCorrect,
      answer: userAnswer,
      level: currentSessionLevel,
    };

    setSessionResults([...sessionResults, newSessionResult]);
    setAllSessionResults([...allSessionResults, newSessionResult]);

    setScore(newScore);
    setLives(newLives);
    setStreak(newStreak);
    setAnswer("");

    if (newLives <= 0) {
      setTimeout(() => {
        setGameOver(true);
      }, 2000);
    } else if (currentIndex >= words.length - 1) {
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
    const nextLevelNumber = currentSessionLevel + 1;

    if (nextLevelNumber > 100) {
      setTotalSessionScore(totalSessionScore + levelScore);
      setGameOver(true);
      return;
    }

    try {
      setLoading(true);
      const nextLevelWords = await fetchWordsForLevel(nextLevelNumber);
      setWords(nextLevelWords);
      setCurrentSessionLevel(nextLevelNumber);
      setCurrentIndex(0);
      setAnswer("");
      setFeedback("");
      setScore(0);
      setStreak(0);
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

  const startNewSession = () => {
    window.location.reload();
  };

  const saveSession = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user.id;
      const correctCount = allSessionResults.filter((r) => r.correct).length;
      const finalScore = totalSessionScore + score;

      console.log("Saving session with:", {
        userId,
        score: finalScore,
        correctCount,
        totalWords: allSessionResults.length,
      });

      // Save session
      const { error: sessionError } = await supabase.from("sessions").insert([
        {
          user_id: userId,
          score: finalScore,
          correct_answers: correctCount,
          total_words: allSessionResults.length,
          ended_at: new Date(),
        },
      ]);

      if (sessionError) {
        console.error("Session save error:", sessionError);
        throw sessionError;
      }

      // Save progress for each unique word
      const uniqueWords = new Map();
      for (const result of allSessionResults) {
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

      alert("Session saved!");
      goBack();
    } catch (error) {
      console.error("Error saving session:", error);
      alert("Failed to save session: " + error.message);
    }
  };

  if (gameOver) {
    const correctCount = allSessionResults.filter((r) => r.correct).length;
    const finalScore = totalSessionScore + score;

    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h1>🎮 Game Over!</h1>
        <div style={{ fontSize: "24px", margin: "20px 0" }}>
          <p>Final Score: <strong>{finalScore}</strong></p>
          <p>Levels Completed: <strong>{currentSessionLevel}</strong></p>
          <p>Total Correct: {correctCount}/{allSessionResults.length}</p>
          <p>Lives left: {lives}</p>
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
      <h1>Play Mode - Level {currentSessionLevel}/100</h1>

      <div style={{ marginBottom: "30px", fontSize: "18px" }}>
        <p>
          <strong>Word {currentIndex + 1}/{words.length}:</strong> {currentWord.category}
        </p>
        <p>
          Total Score: <strong>{totalSessionScore + score}</strong> | Lives: {lives}/5 | Streak: {streak}
        </p>
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