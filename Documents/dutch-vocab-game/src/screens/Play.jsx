import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../supabaseClient";

const ANIMATIONS = `
@keyframes floatUp {
  0%   { opacity: 0; transform: translate(-50%, 6px) scale(0.8); }
  15%  { opacity: 1; transform: translate(-50%, -4px) scale(1.15); }
  100% { opacity: 0; transform: translate(-50%, -34px) scale(1); }
}
@keyframes dotPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(6,182,212,0.6); }
  50%      { transform: scale(1.25); box-shadow: 0 0 0 5px rgba(6,182,212,0); }
}
@keyframes heartBreak {
  0%   { transform: scale(1); }
  20%  { transform: scale(1.5) rotate(-14deg); }
  40%  { transform: scale(1.2) rotate(14deg); }
  60%  { transform: scale(0.8) rotate(-8deg); }
  100% { transform: scale(1) rotate(0); }
}
@keyframes heartBeat {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.2); }
}
@keyframes inputShake {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-8px); }
  40%      { transform: translateX(8px); }
  60%      { transform: translateX(-5px); }
  80%      { transform: translateX(5px); }
}
@keyframes splashPop {
  0%   { opacity: 0; transform: scale(0.3); }
  60%  { opacity: 1; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes confettiFall {
  0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
}
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
`;

// Short victory fanfare built with the Web Audio API (no sound files needed)
function playCelebration(ctx, volume) {
  const master = ctx.createGain();
  master.gain.value = (volume / 100) * 0.5;
  master.connect(ctx.destination);

  const tone = (freq, start, duration, type = "triangle", level = 1) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + start;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(level, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  };

  // Rising run: C5 E5 G5 C6
  tone(523.25, 0.0, 0.16);
  tone(659.25, 0.13, 0.16);
  tone(783.99, 0.26, 0.16);
  tone(1046.5, 0.39, 0.3);
  // Short answer: G5 C6
  tone(783.99, 0.78, 0.14);
  tone(1046.5, 0.9, 0.14);
  // Big final chord: C6 E6 G6 + sparkle on top
  tone(1046.5, 1.05, 1.0);
  tone(1318.5, 1.05, 1.0);
  tone(1568.0, 1.05, 1.0);
  tone(2093.0, 1.05, 0.6, "square", 0.12);
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.6,
        size: 6 + Math.random() * 6,
        color: ["#fbbf24", "#06b6d4", "#7c3aed", "#22c55e", "#ef4444", "#3b82f6"][i % 6],
      })),
    []
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 200,
      }}
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: "-20px",
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            borderRadius: "2px",
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

function PlayGame({ goBack, onRestart }) {
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answerLocked, setAnswerLocked] = useState(false);
  // Ref blocks rapid repeated submits immediately, before React re-renders.
  const answerLockedRef = useRef(false);
  const [feedback, setFeedback] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportedWord, setReportedWord] = useState(null);
  const [reportComment, setReportComment] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [lastAnswerWrong, setLastAnswerWrong] = useState(false);
  const [wrongAnswerCard, setWrongAnswerCard] = useState(null);
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

  // Visual feedback state
  const [answerState, setAnswerState] = useState(null); // "correct" | "wrong" | null
  const [bonusPop, setBonusPop] = useState(null); // { id, text }
  const [heartHit, setHeartHit] = useState(null); // { index, id }
  const [heartGained, setHeartGained] = useState(false);
  const sessionSavedRef = useRef(false); // a game is saved only once
  const [finalScore, setFinalScore] = useState(0);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // "saving" | "saved" | "error"
  const [saveErrorMsg, setSaveErrorMsg] = useState("");
  const [wordSaveStatus, setWordSaveStatus] = useState(null); // "saving" | "saved" | "error"
  const [wordSaveError, setWordSaveError] = useState("");
  const [shownScore, setShownScore] = useState(0);
  const shownRef = useRef(0);
  const targetScore = totalSessionScore + score;

  // Score counts up smoothly instead of jumping
  useEffect(() => {
    const from = shownRef.current;
    const to = targetScore;
    if (from === to) return;
    const start = performance.now();
    const duration = 500;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const value = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      shownRef.current = value;
      setShownScore(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetScore]);

  // One shared audio context. iPhone only allows sound after a tap, and a
  // context created during a tap keeps working later (e.g. at level end).
  const audioCtxRef = useRef(null);
  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playSound = (type) => {
    const soundEnabled = localStorage.getItem("soundEnabled") !== "false";
    const volume = parseFloat(localStorage.getItem("volume")) || 70;

    if (!soundEnabled) return;

    if (type === "celebrate") {
      try {
        playCelebration(getAudioCtx(), volume);
      } catch (e) {}
      return;
    }

    try {
      const audioContext = getAudioCtx();
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

const getMaxDifficultyForLevel = (levelNumber) => {
  if (levelNumber <= 2) return 1;
  if (levelNumber <= 5) return 2;
  if (levelNumber <= 10) return 3;
  if (levelNumber <= 20) return 4;
  if (levelNumber <= 30) return 5;
  if (levelNumber <= 40) return 6;
  if (levelNumber <= 55) return 7;
  if (levelNumber <= 70) return 8;
  if (levelNumber <= 85) return 9;
  return 10; // livelli 86–100
};

const fetchWordsForLevel = async (levelNumber) => {
  try {
    const maxDifficulty = getMaxDifficultyForLevel(levelNumber);

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

  // iPhone: detect when the keyboard is open so the top area can shrink
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => setKeyboardOpen(window.innerHeight - vv.height > 150);
    vv.addEventListener("resize", check);
    check();
    return () => vv.removeEventListener("resize", check);
  }, []);

  // After the game ends: show the splash for a moment, then the overview
  useEffect(() => {
    if (!gameOver || summaryVisible) return;
    const t = setTimeout(() => setSummaryVisible(true), 2500);
    return () => clearTimeout(t);
  }, [gameOver, summaryVisible]);

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

  const submitWordIssueReport = async (e) => {
    e.preventDefault();
    const comment = reportComment.trim();
    if (!comment) { setReportStatus("Please add a comment."); return; }
    setReportStatus("Submitting...");
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) { setReportStatus("Please sign in again to submit a report."); return; }
      const { error } = await supabase.from("word_issue_reports").insert({
        user_id: userData.user.id,
        english_word: reportedWord?.english ?? currentWord.english,
        dutch_word: reportedWord?.dutch ?? currentWord.dutch,
        comment,
      });
      if (error) throw error;
      setReportStatus("Report submitted. Thank you!");
      setReportComment("");
      setTimeout(() => { setReportOpen(false); setReportStatus(""); }, 1400);
    } catch (error) {
      console.error("Word issue report failed:", error);
      setReportStatus("Couldn't submit. Please try again.");
    }
  };

  // Persist each answer immediately. Session-end saving below only stores the score/summary.
  const saveWordAttempt = async (wordId, isCorrect) => {
    setWordSaveStatus("saving");
    setWordSaveError("");

    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = userData?.user?.id;
      if (!userId) throw new Error("You are not signed in. Please sign in again.");

      const { data: existing, error: fetchError } = await supabase
        .from("user_progress")
        .select("id, correct_count, incorrect_count")
        .eq("user_id", userId)
        .eq("word_id", wordId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        const correctCount = Number(existing.correct_count || 0) + (isCorrect ? 1 : 0);
        const incorrectCount = Number(existing.incorrect_count || 0) + (isCorrect ? 0 : 1);
        const { error: updateError } = await supabase
          .from("user_progress")
          .update({
            correct_count: correctCount,
            incorrect_count: incorrectCount,
            mastered: correctCount >= 10,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("user_progress").insert({
          user_id: userId,
          word_id: wordId,
          correct_count: isCorrect ? 1 : 0,
          incorrect_count: isCorrect ? 0 : 1,
          mastered: false,
          last_seen_at: new Date().toISOString(),
        });
        if (insertError) throw insertError;
      }

      setWordSaveStatus("saved");
      return true;
    } catch (error) {
      console.error("Word progress save failed:", error);
      setWordSaveStatus("error");
      setWordSaveError(error?.message || "Unknown database error");
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // A question can be scored only once, including when the answer is blank.
    if (answerLockedRef.current || gameOver || levelCompleted || loading) return;
    answerLockedRef.current = true;
    setAnswerLocked(true);
    const userAnswer = answer.toLowerCase().trim();
    setLastAnswerWrong(false);

const normalizeDutch = (str) => {
  return str
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "") // rimuove punteggiatura
    .replace(/ï/g, "i")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/\s+/g, " ");
};

const normalizeEnglish = (str) => {
  return str
    .trim() // ⚠️ NON toLowerCase subito
    .replace(/\s+/g, " "); // preserva "to "
};


    const correctFull = currentWord.dutch.toLowerCase().trim();
    const correctBase = correctFull
      .split(",")[0]
      .replace(/^(de |het |een |het )/, "")
      .trim();

const normalizedAnswer = normalizeDutch(userAnswer);

const normalizedFull = normalizeDutch(correctFull);

const normalizedBase = normalizeDutch(
  correctFull.split(",")[0]
);

const normalizedWithDe = normalizeDutch(`de ${normalizedBase}`);
const normalizedWithHet = normalizeDutch(`het ${normalizedBase}`);


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
      // Capture the missed word now; currentWord changes when the next round starts.
      setReportedWord({ english: currentWord.english, dutch: currentWord.dutch });
      setLastAnswerWrong(true);
    }

    if (isCorrect) {
      setAnswerState("correct");
      setBonusPop({ id: Date.now(), text: `+${wordPoints + streakBonusThisRound}` });
    } else {
      setAnswerState("wrong");
      setHeartHit({ index: newLives, id: Date.now() });
    }
    setTimeout(() => setAnswerState(null), 700);
    setTimeout(() => setBonusPop(null), 1000);
    setTimeout(() => setHeartHit(null), 800);

    const newUsedWords = new Set(usedWordIds);
    newUsedWords.add(currentWord.id);
    setUsedWordIds(newUsedWords);

    const newAllUsedWords = new Set(allUsedWordIds);
    newAllUsedWords.add(currentWord.id);
    setAllUsedWordIds(newAllUsedWords);

    const newSessionResult = {
      wordId: currentWord.id,
      word: currentWord.english,
      dutch: currentWord.dutch,
      correct: isCorrect,
      answer: userAnswer,
      level: currentLevel,
    };

    // Wait for this attempt's progress write before allowing the next question.
    // Feedback is already shown above; a failure is surfaced in the UI below.
    await saveWordAttempt(currentWord.id, isCorrect);

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

    const transition = newLives <= 0
      ? "gameOver"
      : (newQuestionsInLevel >= QUESTIONS_PER_LEVEL || currentIndex >= words.length - 1)
        ? "nextLevel"
        : "nextQuestion";

    if (!isCorrect) {
      // Wrong answers pause here until the player has read the correction and continues.
      setWrongAnswerCard({
        english: currentWord.english,
        dutch: currentWord.dutch,
        userAnswer,
        transition,
        newScore,
        newQuestionsInLevel,
        newLives,
        results: [...allSessionResults, newSessionResult],
        totalSessionScore,
        currentWordId: currentWord.id,
        currentIndex,
      });
    } else if (transition === "gameOver") {
      setTimeout(() => {
        const finalPoints = newScore + totalSessionScore;
        setFinalScore(finalPoints);
        saveSessionAuto(finalPoints, [...allSessionResults, newSessionResult]);
        setGameOver(true);
      }, 2000);
    } else if (transition === "nextLevel") {
      setTimeout(() => {
        nextLevel(newScore, newQuestionsInLevel, newLives);
      }, 2000);
    } else {
      setTimeout(() => {
        const nextIndex = currentIndex + 1;
        if (nextIndex < words.length) {
          if (words[nextIndex].id === currentWord.id) {
            let findIndex = nextIndex + 1;
            while (findIndex < words.length && words[findIndex].id === currentWord.id) findIndex++;
            setCurrentIndex(findIndex < words.length ? findIndex : nextIndex);
          } else {
            setCurrentIndex(nextIndex);
          }
        }
        setFeedback("");
        setLastAnswerWrong(false);
        answerLockedRef.current = false;
        setAnswerLocked(false);
      }, 2000);
    }
  };

  const continueAfterWrongAnswer = () => {
    if (!wrongAnswerCard) return;
    const pending = wrongAnswerCard;
    setWrongAnswerCard(null);
    setReportOpen(false);
    setReportStatus("");
    setLastAnswerWrong(false);

    if (pending.transition === "gameOver") {
      const finalPoints = pending.newScore + pending.totalSessionScore;
      setFinalScore(finalPoints);
      saveSessionAuto(finalPoints, pending.results);
      setGameOver(true);
      return;
    }
    if (pending.transition === "nextLevel") {
      nextLevel(pending.newScore, pending.newQuestionsInLevel, pending.newLives);
      return;
    }

    const nextIndex = pending.currentIndex + 1;
    if (nextIndex < words.length) {
      if (words[nextIndex].id === pending.currentWordId) {
        let findIndex = nextIndex + 1;
        while (findIndex < words.length && words[findIndex].id === pending.currentWordId) findIndex++;
        setCurrentIndex(findIndex < words.length ? findIndex : nextIndex);
      } else {
        setCurrentIndex(nextIndex);
      }
    }
    setFeedback("");
    answerLockedRef.current = false;
    setAnswerLocked(false);
  };

  const nextLevel = async (levelScore, totalQuestionsInLevel, livesNow) => {
    const nextLevelNumber = currentLevel + 1;
    const levelBonus = currentLevel * 10;

    setLevelStats((prev) => ({
      ...prev,
      levelBonus,
    }));

    if (nextLevelNumber > 100) {
      const finalPoints = totalSessionScore + levelScore + levelBonus;
      setFinalScore(finalPoints);
      saveSessionAuto(finalPoints, allSessionResults);
      setTotalSessionScore(totalSessionScore + levelScore + levelBonus);
      setGameOver(true);
      setLevelCompleted(false);
      return;
    }

    // Reward: +1 heart for completing the level (maximum 5)
    const gained = livesNow < 5;
    setHeartGained(gained);
    if (gained) setLives(Math.min(5, livesNow + 1));

    playSound("celebrate");
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
      answerLockedRef.current = false;
      setAnswerLocked(false);
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
    if (sessionSavedRef.current || results.length === 0) return;
    sessionSavedRef.current = true;
    setSaveStatus("saving");
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = userData?.user?.id;
      if (!userId) throw new Error("You are not signed in. Please sign in again.");

      const correctCount = results.filter((r) => r.correct).length;
      const { error: sessionError } = await supabase.from("sessions").insert([
        {
          user_id: userId,
          score: finalScore,
          correct_answers: correctCount,
          total_words: results.length,
          ended_at: new Date().toISOString(),
          level: currentLevel,
        },
      ]);

      if (sessionError) throw sessionError;
      setSaveStatus("saved");
      console.log("Session summary saved. Word progress was saved per answer.");
    } catch (error) {
      console.error("Error saving session summary:", error);
      setSaveStatus("error");
      setSaveErrorMsg(error?.message || "Unknown error");
    }
  };

  // Leaving mid-game: save the points earned so far, then go back
  const handleExit = async () => {
    if (!gameOver) {
      await saveSessionAuto(totalSessionScore + score, allSessionResults);
    }
    goBack();
  };

  const startNewGame = () => {
    onRestart();
  };

  const renderHearts = () => {
    const hearts = [];
    for (let i = 0; i < 5; i++) {
      const justLost = heartHit && heartHit.index === i;
      const lastOne = lives === 1 && i === 0;
      hearts.push(
        <span
          key={justLost ? `${i}-${heartHit.id}` : i}
          style={{
            ...styles.heart,
            ...(justLost
              ? { animation: "heartBreak 0.7s ease-out" }
              : lastOne
              ? { animation: "heartBeat 1s ease-in-out infinite" }
              : {}),
          }}
        >
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
        <style>{ANIMATIONS}</style>
        <Confetti />
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

          <div style={styles.breakdownRow}>
            <span style={styles.breakdownLabel}>Heart Bonus</span>
            <span style={styles.breakdownValue}>
              {heartGained ? "+1 ❤️" : "Hearts full ❤️"}
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

    const lost = lives <= 0;

    // Step 1: "Game Over" splash (tap to skip)
    if (!summaryVisible) {
      return (
        <div style={styles.splashContainer} onClick={() => setSummaryVisible(true)}>
          <style>{ANIMATIONS}</style>
          {!lost && <Confetti />}
          <div style={{ fontSize: "72px", animation: "splashPop 0.7s ease-out" }}>
            {lost ? "💔" : "🏆"}
          </div>
          <h1
            style={{
              ...styles.splashTitle,
              color: lost ? "#fca5a5" : "#fbbf24",
              animation: "splashPop 0.7s ease-out",
            }}
          >
            {lost ? "GAME OVER" : "YOU WON!"}
          </h1>
          <p style={styles.splashScore}>{finalScore.toLocaleString()} pts</p>
          <p style={styles.splashHint}>Tap to continue</p>
        </div>
      );
    }

    // Step 2: overview
    return (
      <div style={styles.gameOverContainer}>
        <div style={styles.gameOverHeader}>
          <h1 style={{ ...styles.gameOverTitle, textAlign: "center" }}>
            {lost ? "Game Over" : "You Won! 🏆"}
          </h1>
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

        {saveStatus && (
          <p
            style={{
              ...styles.saveStatus,
              color:
                saveStatus === "error"
                  ? "#fca5a5"
                  : saveStatus === "saved"
                  ? "#86efac"
                  : "#bfdbfe",
            }}
          >
            {saveStatus === "saved"
              ? "✅ Score saved to the leaderboard"
              : saveStatus === "error"
              ? `⚠️ Score could not be saved: ${saveErrorMsg}`
              : "Saving score…"}
          </p>
        )}

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
      <style>{ANIMATIONS}</style>
      <div style={styles.stickyTop}>
      <div style={styles.header}>
        <h1 style={styles.title}>🎮 Level {currentLevel}</h1>
        <div style={styles.headerRight}>
          <div style={styles.livesContainer}>{renderHearts()}</div>
          <button
            onClick={handleExit}
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
            {keyboardOpen ? "←" : "← Menu"}
          </button>
        </div>
      </div>

      <div style={keyboardOpen ? styles.hudCompact : styles.hud}>
        <div style={styles.scoreWrap}>
          <span style={keyboardOpen ? styles.scoreCompact : styles.scoreBig}>
            {shownScore.toLocaleString()}
          </span>
          {streak > 0 && <span style={styles.streakChip}>🔥 {streak}</span>}
          {bonusPop && (
            <span key={bonusPop.id} style={styles.bonusPop}>
              {bonusPop.text}
            </span>
          )}
        </div>

        <div style={styles.dots}>
          {Array.from({ length: QUESTIONS_PER_LEVEL }).map((_, i) => {
            const result = sessionResults[i];
            const isCurrent = !result && i === questionsInLevel;
            return (
              <span
                key={i}
                style={{
                  ...styles.dot,
                  ...(keyboardOpen ? styles.dotSmall : {}),
                  background: result
                    ? result.correct
                      ? "#22c55e"
                      : "#ef4444"
                    : isCurrent
                    ? "#06b6d4"
                    : "rgba(6,182,212,0.2)",
                  animation: isCurrent
                    ? "dotPulse 1.2s ease-in-out infinite"
                    : "none",
                }}
              />
            );
          })}
        </div>
      </div>

      </div>

      <div style={styles.questionContainer}>
        <p style={styles.questionLabel}>
          Q{questionsInLevel + 1}/{QUESTIONS_PER_LEVEL}
        </p>
        <h2 style={styles.questionText}>Translate to Dutch:</h2>
        <h1
          style={{
            ...styles.wordToTranslate,
            ...(keyboardOpen ? { fontSize: "28px" } : {}),
          }}
        >
          {currentWord.english}
        </h1>
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
          style={{
            ...styles.input,
            ...(answerState === "correct"
              ? styles.inputCorrect
              : answerState === "wrong"
              ? styles.inputWrong
              : {}),
          }}
          disabled={gameOver || answerLocked || levelCompleted || loading}
          autoFocus
        />
        <button type="submit" style={styles.submitButton} disabled={gameOver || answerLocked || levelCompleted || loading}>
          Submit
        </button>
      </form>

      {feedback && !wrongAnswerCard && (
        <p style={{ ...styles.feedback, color: feedback.includes("✅") ? "#10b981" : "#ef4444" }}>
          {feedback}
        </p>
      )}

      {wordSaveStatus === "saving" && (
        <p role="status" style={{ textAlign: "center", color: "#64748b", padding: "0 16px" }}>Saving word progress…</p>
      )}
      {wordSaveStatus === "saved" && (
        <p role="status" style={{ textAlign: "center", color: "#16a34a", padding: "0 16px" }}>Word progress saved.</p>
      )}
      {wordSaveStatus === "error" && (
        <p role="alert" style={{ textAlign: "center", color: "#dc2626", padding: "0 16px" }}>
          ⚠️ This answer could not be saved to Your Words: {wordSaveError}. Please take a screenshot and check the database before continuing.
        </p>
      )}

      {lastAnswerWrong && !reportOpen && !wrongAnswerCard && (
        <div style={{ textAlign: "center", padding: "0 16px 14px" }}>
          <button type="button" onClick={() => setReportOpen(true)} style={styles.reportIssueButton}>⚑ Report issue</button>
        </div>
      )}

      {reportOpen && !wrongAnswerCard && (
        <form onSubmit={submitWordIssueReport} style={styles.reportForm}>
          <h3 style={styles.reportTitle}>Report a word issue</h3>
          <p style={styles.reportWord}><strong>{reportedWord?.english ?? currentWord.english}</strong> → {reportedWord?.dutch ?? currentWord.dutch}</p>
          <textarea value={reportComment} onChange={(e) => setReportComment(e.target.value)}
            placeholder="What's wrong with this word or translation?" maxLength={1000}
            required rows={3} style={styles.reportTextarea} />
          <div style={styles.reportActions}>
            <button type="button" onClick={() => { setReportOpen(false); setReportStatus(""); }} style={styles.reportCancelButton}>Cancel</button>
            <button type="submit" style={styles.reportSubmitButton}>Submit report</button>
          </div>
          {reportStatus && <p style={styles.reportStatus} role="status">{reportStatus}</p>}
        </form>
      )}

      {wrongAnswerCard && (
        <div role="dialog" aria-modal="true" aria-labelledby="wrong-answer-title" style={styles.wrongAnswerOverlay}>
          <div style={styles.wrongAnswerCard}>
            {!reportOpen ? (
              <>
                <div style={styles.wrongAnswerIcon}>✕</div>
                <p style={styles.wrongAnswerEyebrow}>NOT QUITE</p>
                <h2 id="wrong-answer-title" style={styles.wrongAnswerTitle}>Learn from this one</h2>
                <p style={styles.wrongAnswerEnglish}>{wrongAnswerCard.english}</p>
                <div style={styles.correctAnswerBox}>
                  <span style={styles.correctAnswerLabel}>CORRECT ANSWER</span>
                  <strong style={styles.correctAnswerDutch}>{wrongAnswerCard.dutch}</strong>
                </div>
                <p style={styles.wrongAnswerNote}>
                  {wrongAnswerCard.userAnswer
                    ? <>Your answer: <strong>{wrongAnswerCard.userAnswer}</strong></>
                    : "No answer entered"}
                  {" · ❤️ One life lost"}
                </p>
                <button type="button" onClick={continueAfterWrongAnswer} style={styles.wrongAnswerContinueButton}>
                  {wrongAnswerCard.transition === "gameOver" ? "See Results" : wrongAnswerCard.transition === "nextLevel" ? "Continue" : "Next Question"}
                  <span aria-hidden="true"> →</span>
                </button>
                <button type="button" onClick={() => setReportOpen(true)} style={styles.wrongAnswerReportButton}>⚑ Report issue with this word</button>
              </>
            ) : (
              <form onSubmit={submitWordIssueReport}>
                <h2 id="wrong-answer-title" style={styles.reportTitle}>Report a word issue</h2>
                <p style={styles.reportWord}><strong>{wrongAnswerCard.english}</strong> → {wrongAnswerCard.dutch}</p>
                <textarea value={reportComment} onChange={(e) => setReportComment(e.target.value)}
                  placeholder="What's wrong with this word or translation?" maxLength={1000}
                  required rows={3} style={styles.reportTextarea} />
                <div style={styles.reportActions}>
                  <button type="button" onClick={() => { setReportOpen(false); setReportStatus(""); }} style={styles.reportCancelButton}>Back</button>
                  <button type="submit" style={styles.reportSubmitButton}>Submit report</button>
                </div>
                {reportStatus && <p style={styles.reportStatus} role="status">{reportStatus}</p>}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrongAnswerOverlay: {
    position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "max(18px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom))",
    background: "rgba(2, 6, 23, 0.82)", backdropFilter: "blur(8px)", overflowY: "auto",
  },
  wrongAnswerCard: {
    width: "100%", maxWidth: "420px", maxHeight: "100%", overflowY: "auto", boxSizing: "border-box",
    padding: "26px 22px 22px", borderRadius: "26px", textAlign: "center", color: "#f8fafc",
    background: "linear-gradient(160deg, #1e293b 0%, #172554 100%)", border: "1px solid rgba(148,163,184,0.35)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
  },
  wrongAnswerIcon: {
    width: "48px", height: "48px", margin: "0 auto 10px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(248,113,113,0.15)", border: "2px solid #f87171", color: "#fca5a5", fontSize: "24px", fontWeight: 900,
  },
  wrongAnswerEyebrow: { margin: "0 0 5px", color: "#fca5a5", fontSize: "12px", fontWeight: 900, letterSpacing: "2px" },
  wrongAnswerTitle: { margin: "0 0 14px", fontSize: "24px", lineHeight: 1.2, fontWeight: 850 },
  wrongAnswerEnglish: { margin: "0 0 14px", fontSize: "17px", color: "#cbd5e1" },
  correctAnswerBox: { display: "flex", flexDirection: "column", gap: "7px", padding: "17px 14px", borderRadius: "16px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(52,211,153,0.55)" },
  correctAnswerLabel: { color: "#6ee7b7", fontSize: "11px", fontWeight: 900, letterSpacing: "1.5px" },
  correctAnswerDutch: { color: "#ecfdf5", fontSize: "clamp(24px, 7vw, 32px)", overflowWrap: "anywhere", lineHeight: 1.2 },
  wrongAnswerNote: { margin: "14px 0 18px", color: "#cbd5e1", fontSize: "13px", lineHeight: 1.5, overflowWrap: "anywhere" },
  wrongAnswerContinueButton: { width: "100%", border: 0, borderRadius: "14px", padding: "15px 18px", color: "#052e2b", background: "linear-gradient(135deg, #6ee7b7, #34d399)", fontSize: "16px", fontWeight: 850, cursor: "pointer", boxShadow: "0 8px 22px rgba(16,185,129,0.2)" },
  wrongAnswerReportButton: { marginTop: "12px", padding: "10px 12px", border: "1px solid rgba(148,163,184,0.35)", borderRadius: "10px", color: "#cbd5e1", background: "transparent", fontSize: "13px", cursor: "pointer" },
  container: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: "var(--vv-height, 100%)",
    transform: "translateY(var(--vv-top, 0px))",
    overflowY: "auto",
    overflowX: "hidden",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    padding: "0",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  stickyTop: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
  },
  hud: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    padding: "12px 16px 14px",
  },
  hudCompact: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "6px 16px 8px",
  },
  dots: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
  },
  dot: {
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    transition: "background 0.3s ease",
  },
  dotSmall: {
    width: "9px",
    height: "9px",
  },
  scoreWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  scoreBig: {
    fontSize: "clamp(34px, 10vw, 44px)",
    fontWeight: "800",
    color: "#fbbf24",
    lineHeight: 1,
    textShadow: "0 2px 12px rgba(251,191,36,0.35)",
    fontVariantNumeric: "tabular-nums",
  },
  scoreCompact: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#fbbf24",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  streakChip: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#fdba74",
    background: "rgba(249,115,22,0.18)",
    border: "1px solid rgba(249,115,22,0.4)",
    borderRadius: "999px",
    padding: "2px 8px",
    whiteSpace: "nowrap",
  },
  bonusPop: {
    position: "absolute",
    top: "-6px",
    left: "50%",
    color: "#22c55e",
    fontWeight: "800",
    fontSize: "18px",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    animation: "floatUp 1s ease-out forwards",
    textShadow: "0 2px 8px rgba(0,0,0,0.5)",
  },
  inputCorrect: {
    borderColor: "#22c55e",
    boxShadow: "0 0 0 3px rgba(34,197,94,0.4)",
    background: "#ecfdf5",
  },
  inputWrong: {
    borderColor: "#ef4444",
    boxShadow: "0 0 0 3px rgba(239,68,68,0.4)",
    background: "#fef2f2",
    animation: "inputShake 0.4s ease-in-out",
  },
  header: {
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid rgba(6,182,212,0.2)",
    gap: "8px",
  },
  title: {
    fontSize: "clamp(18px, 5vw, 24px)",
    fontWeight: "800",
    margin: "0",
    color: "white",
    textShadow: "0 2px 8px rgba(6,182,212,0.3)",
    flex: "1 1 auto",
    whiteSpace: "nowrap",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  livesContainer: {
    display: "flex",
    gap: "2px",
    fontSize: "clamp(14px, 4vw, 18px)",
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
    padding: "0 16px 12px",
    boxSizing: "border-box",
    width: "100%",
  },
  input: {
    padding: "10px 12px",
    fontSize: "16px", // 16px+ prevents iOS from auto-zooming on focus
    border: "1px solid rgba(6,182,212,0.4)",
    borderRadius: "6px",
    flex: 1,
    minWidth: 0,
    boxSizing: "border-box",
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
  splashContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "20px",
    cursor: "pointer",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  splashTitle: {
    fontSize: "clamp(40px, 12vw, 64px)",
    fontWeight: "900",
    letterSpacing: "3px",
    margin: "12px 0 6px",
    textShadow: "0 4px 20px rgba(0,0,0,0.5)",
  },
  splashScore: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#fbbf24",
    margin: "0",
  },
  splashHint: {
    fontSize: "13px",
    color: "#93c5fd",
    marginTop: "28px",
  },
  saveStatus: {
    textAlign: "center",
    fontSize: "13px",
    fontWeight: "600",
    margin: "0 0 14px",
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
  reportIssueButton: { padding: "8px 12px", fontSize: "13px", fontWeight: "600", background: "rgba(255,255,255,0.1)", color: "#bfdbfe", border: "1px solid rgba(147,197,253,0.5)", borderRadius: "8px", cursor: "pointer" },
  reportForm: { margin: "0 16px 16px", padding: "14px", border: "1px solid rgba(147,197,253,0.45)", borderRadius: "10px", background: "rgba(15,23,42,0.96)", color: "white" },
  reportTitle: { margin: "0 0 8px", fontSize: "16px" },
  reportWord: { margin: "0 0 10px", color: "#bfdbfe", fontSize: "14px" },
  reportTextarea: { width: "100%", boxSizing: "border-box", padding: "10px", minHeight: "96px", borderRadius: "7px", border: "1px solid #cbd5e1", background: "#ffffff", font: "inherit", resize: "vertical", color: "#111827", caretColor: "#111827", outlineColor: "#2563eb", colorScheme: "light" },
  reportActions: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" },
  reportCancelButton: { padding: "9px 12px", borderRadius: "7px", border: "1px solid #64748b", color: "white", background: "transparent", cursor: "pointer" },
  reportSubmitButton: { padding: "9px 12px", borderRadius: "7px", border: "none", color: "white", background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)", fontWeight: "700", cursor: "pointer" },
  reportStatus: { margin: "10px 0 0", fontSize: "13px", color: "#bfdbfe" },
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

// Wrapper: "New Game" remounts PlayGame, which resets everything cleanly
function Play({ goBack }) {
  const [round, setRound] = useState(0);
  return (
    <PlayGame
      key={round}
      goBack={goBack}
      onRestart={() => setRound((r) => r + 1)}
    />
  );
}

export default Play;