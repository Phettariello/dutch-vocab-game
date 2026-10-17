import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../supabaseClient";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const ALL_DIFFICULTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Same accuracy buckets as Review.jsx
const ACCURACY_BUCKETS = [
  { id: "0-25", label: "0–25%", test: (p) => p < 25 },
  { id: "25-50", label: "25–50%", test: (p) => p >= 25 && p < 50 },
  { id: "50-75", label: "50–75%", test: (p) => p >= 50 && p < 75 },
  { id: "75-99", label: "75–99%", test: (p) => p >= 75 && p < 100 },
  { id: "100", label: "100%", test: (p) => p >= 100 },
];
const ALL_BUCKET_IDS = ACCURACY_BUCKETS.map((b) => b.id);

// Sorting. Each key has a "natural" first direction (asc) used when a column header is tapped.
const SORT_OPTIONS = [
  { value: "mastery:asc", label: "Mastery: low → high (hardest first)" },
  { value: "mastery:desc", label: "Mastery: high → low" },
  { value: "english:asc", label: "English: A → Z" },
  { value: "english:desc", label: "English: Z → A" },
  { value: "dutch:asc", label: "Dutch: A → Z" },
  { value: "dutch:desc", label: "Dutch: Z → A" },
  { value: "difficulty:asc", label: "Difficulty: 1 → 10" },
  { value: "difficulty:desc", label: "Difficulty: 10 → 1" },
  { value: "incorrect:desc", label: "Most wrong answers" },
  { value: "incorrect:asc", label: "Fewest wrong answers" },
  { value: "correct:desc", label: "Most correct answers" },
  { value: "correct:asc", label: "Fewest correct answers" },
];

const stripArticle = (s = "") => s.toLowerCase().trim().replace(/^(de|het|een) /, "");
const compareText = (a, b) => a.localeCompare(b, "nl", { sensitivity: "base" });

const COMPARERS = {
  english: (a, b) => compareText(a.words.english || "", b.words.english || ""),
  dutch: (a, b) => compareText(stripArticle(a.words.dutch), stripArticle(b.words.dutch)),
  difficulty: (a, b) => (a.words.difficulty || 0) - (b.words.difficulty || 0),
  correct: (a, b) => a.correct_count - b.correct_count,
  incorrect: (a, b) => a.incorrect_count - b.incorrect_count,
  mastery: (a, b) => a.masteryPercent - b.masteryPercent,
};

// Load every row of a query (Supabase returns max 1000 rows per request)
async function fetchAllRows(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await buildQuery().range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function YourWords({ goBack }) {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Search, filters, sort
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [selectedDifficulties, setSelectedDifficulties] = useState(new Set(ALL_DIFFICULTIES));
  const [selectedAccuracy, setSelectedAccuracy] = useState(new Set(ALL_BUCKET_IDS));
  const [masteredFilter, setMasteredFilter] = useState("both");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState({ key: "mastery", dir: "asc" });

  // Scrolling
  const scrollRef = useRef(null);
  const [showTop, setShowTop] = useState(false);

  // Mistake history pop-up
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedWord, setSelectedWord] = useState(null);
  const [mistakes, setMistakes] = useState([]);
  const [mistakesLoading, setMistakesLoading] = useState(false);
  const [mistakesError, setMistakesError] = useState("");

  // ============================================================================
  // LOAD WORDS (user_progress + words, aggregated per word)
  // ============================================================================
  useEffect(() => {
    let active = true;

    const fetchWords = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) {
          if (active) setLoadError("You must be logged in to see your words.");
          return;
        }
        if (active) setCurrentUserId(userId);

        const progressData = await fetchAllRows(() =>
          supabase.from("user_progress").select("*").eq("user_id", userId).order("id")
        );

        // Fetch the word details in chunks (a very long .in() list breaks the URL)
        const wordIds = [...new Set(progressData.map((p) => p.word_id))];
        const chunks = [];
        for (let i = 0; i < wordIds.length; i += 150) chunks.push(wordIds.slice(i, i + 150));
        const results = await Promise.all(
          chunks.map((ids) => supabase.from("words").select("*").in("id", ids))
        );
        const wordsData = [];
        results.forEach((res) => {
          if (res.error) throw res.error;
          wordsData.push(...(res.data || []));
        });
        const wordsMap = new Map(wordsData.map((w) => [w.id, w]));

        // Group by word_id and sum the counts (skip orphans)
        const grouped = {};
        progressData.forEach((entry) => {
          const word = wordsMap.get(entry.word_id);
          if (!word) return;
          if (!grouped[entry.word_id]) {
            grouped[entry.word_id] = {
              word_id: entry.word_id,
              words: word,
              correct_count: 0,
              incorrect_count: 0,
              mastered: false,
            };
          }
          const g = grouped[entry.word_id];
          g.correct_count += entry.correct_count || 0;
          g.incorrect_count += entry.incorrect_count || 0;
          g.mastered = g.mastered || !!entry.mastered;
        });

        const list = Object.values(grouped).map((g) => {
          const total = g.correct_count + g.incorrect_count;
          return {
            ...g,
            total,
            masteryPercent: total > 0 ? Math.round((g.correct_count / total) * 100) : 0,
          };
        });

        if (!active) return;
        const uniqueCategories = [...new Set(list.map((p) => p.words.category).filter(Boolean))].sort();
        setCategories(uniqueCategories);
        setSelectedCategories(new Set(uniqueCategories));
        setSelectedDifficulties(new Set(ALL_DIFFICULTIES));
        setSelectedAccuracy(new Set(ALL_BUCKET_IDS));
        setWords(list);
      } catch (error) {
        console.error("Error fetching words:", error);
        if (active) setLoadError(error?.message || "Failed to load your words.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchWords();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  // ============================================================================
  // DERIVED DATA
  // ============================================================================
  const stats = useMemo(() => {
    const mastered = words.filter((w) => w.mastered).length;
    const correct = words.reduce((s, w) => s + w.correct_count, 0);
    const attempts = words.reduce((s, w) => s + w.total, 0);
    return {
      total: words.length,
      mastered,
      accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
    };
  }, [words]);

  const filteredWords = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const activeBuckets = ACCURACY_BUCKETS.filter((b) => selectedAccuracy.has(b.id));

    const list = words.filter((w) => {
      if (query && !(w.words.english || "").toLowerCase().includes(query) && !(w.words.dutch || "").toLowerCase().includes(query)) return false;
      if (!selectedCategories.has(w.words.category)) return false;
      if (!selectedDifficulties.has(w.words.difficulty)) return false;
      if (!activeBuckets.some((b) => b.test(w.masteryPercent))) return false;
      if (masteredFilter === "nonmastered" && w.mastered) return false;
      if (masteredFilter === "mastered" && !w.mastered) return false;
      return true;
    });

    const mult = sort.dir === "asc" ? 1 : -1;
    const primary = COMPARERS[sort.key];
    return list.sort((a, b) => primary(a, b) * mult || COMPARERS.english(a, b));
  }, [words, searchQuery, selectedCategories, selectedDifficulties, selectedAccuracy, masteredFilter, sort]);

  const activeFilterCount =
    (selectedCategories.size !== categories.length ? 1 : 0) +
    (selectedDifficulties.size !== 10 ? 1 : 0) +
    (selectedAccuracy.size !== ACCURACY_BUCKETS.length ? 1 : 0) +
    (masteredFilter !== "both" ? 1 : 0);

  const resetFilters = () => {
    setSelectedCategories(new Set(categories));
    setSelectedDifficulties(new Set(ALL_DIFFICULTIES));
    setSelectedAccuracy(new Set(ALL_BUCKET_IDS));
    setMasteredFilter("both");
    setSearchQuery("");
  };

  // ============================================================================
  // FILTER HELPERS
  // ============================================================================
  const toggleIn = (set, setter, value) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };
  const toggleAllCategories = () =>
    setSelectedCategories(selectedCategories.size === categories.length ? new Set() : new Set(categories));
  const toggleAllDifficulties = () =>
    setSelectedDifficulties(selectedDifficulties.size === 10 ? new Set() : new Set(ALL_DIFFICULTIES));
  const toggleAllAccuracy = () =>
    setSelectedAccuracy(selectedAccuracy.size === ACCURACY_BUCKETS.length ? new Set() : new Set(ALL_BUCKET_IDS));

  // Tapping a column header: same column flips direction, new column starts ascending
  const sortByColumn = (key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "correct" || key === "incorrect" ? "desc" : "asc" }
    );
  };
  const arrow = (key) => (sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  // ============================================================================
  // SCROLLING
  // ============================================================================
  const onScroll = (e) => {
    const shouldShow = e.currentTarget.scrollTop > 500;
    if (shouldShow !== showTop) setShowTop(shouldShow);
  };
  const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  // ============================================================================
  // MISTAKES POP-UP
  // ============================================================================
  const openMistakes = async (entry) => {
    setSelectedWord(entry);
    setMistakes([]);
    setMistakesError("");
    setMistakesLoading(true);
    try {
      const { data, error } = await supabase
        .from("word_mistakes")
        .select("id, user_answer, correct_answer, mode, level, created_at")
        .eq("user_id", currentUserId)
        .eq("word_id", entry.word_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setMistakes(data || []);
    } catch (error) {
      console.error("Error loading mistakes:", error);
      setMistakesError(error.message || "Could not load mistakes.");
    } finally {
      setMistakesLoading(false);
    }
  };

  const closeMistakes = () => setSelectedWord(null);

  useEffect(() => {
    if (!selectedWord) return;
    const onKey = (e) => e.key === "Escape" && closeMistakes();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedWord]);

  const formatDateTime = (value) =>
    new Date(value).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const chip = (active) => ({ ...styles.chip, ...(active ? styles.chipActive : {}) });

  // ============================================================================
  // HEADER (always visible)
  // ============================================================================
  const header = (
    <div style={styles.header}>
      <h1 style={styles.title}>📖 Your Words</h1>
      <button
        style={styles.backButton}
        onClick={goBack}
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
  );

  if (loading) {
    return (
      <div style={styles.shell}>
        {header}
        <div style={styles.centerState}>Loading your words...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.shell}>
        {header}
        <div style={styles.centerState}>
          <div style={{ fontSize: 44 }}>⚠️</div>
          <p style={{ margin: "8px 0 16px", color: "#fde68a", maxWidth: 320, overflowWrap: "anywhere" }}>{loadError}</p>
          <button style={styles.primaryButton} onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div style={styles.shell}>
        {header}
        <div style={styles.centerState}>
          <div style={{ fontSize: 56 }}>📖</div>
          <p style={{ margin: "8px 0 4px", color: "white", fontSize: 18, fontWeight: 700 }}>No words yet</p>
          <p style={{ margin: 0, color: "#bfdbfe", maxWidth: 300, lineHeight: 1.5 }}>
            Play or Practice a few words and they will appear here.
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <div style={styles.shell}>
      {header}

      <div ref={scrollRef} onScroll={onScroll} style={styles.scrollArea}>
        <div style={styles.inner}>
          {/* STATS */}
          <div style={styles.statsContainer}>
            <div style={styles.statCard}>
              <p style={styles.statValue}>{stats.total}</p>
              <p style={styles.statLabel}>Total words</p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statValue}>{stats.mastered}</p>
              <p style={styles.statLabel}>✅ Mastered</p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statValue}>{stats.accuracy}%</p>
              <p style={styles.statLabel}>📊 Accuracy</p>
            </div>
          </div>

          {/* SEARCH + SORT */}
          <input
            type="text"
            placeholder="Search by English or Dutch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
            aria-label="Search words"
          />

          <div style={styles.sortRow}>
            <label htmlFor="yw-sort" style={styles.sortLabel}>Sort by</label>
            <select
              id="yw-sort"
              value={`${sort.key}:${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":");
                setSort({ key, dir });
              }}
              style={styles.sortSelect}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* FILTERS (same as Review) */}
          <button onClick={() => setFiltersOpen(!filtersOpen)} style={styles.filterToggle}>
            <span>
              🔧 Filters
              {activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}
              {` · ${filteredWords.length} words`}
            </span>
            <span aria-hidden="true">{filtersOpen ? "▲" : "▼"}</span>
          </button>

          {filtersOpen && (
            <div style={styles.filtersContent}>
              <div style={styles.filterGroup}>
                <div style={styles.filterHeader}>
                  <h4 style={styles.filterTitle}>Categories</h4>
                  <button onClick={toggleAllCategories} style={styles.selectAllBtn}>
                    {selectedCategories.size === categories.length ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div style={styles.chipGrid2}>
                  {categories.map((cat) => (
                    <label key={cat} style={chip(selectedCategories.has(cat))}>
                      <input
                        type="checkbox"
                        checked={selectedCategories.has(cat)}
                        onChange={() => toggleIn(selectedCategories, setSelectedCategories, cat)}
                        style={styles.checkbox}
                      />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>

              <div style={styles.filterGroup}>
                <div style={styles.filterHeader}>
                  <h4 style={styles.filterTitle}>Difficulty (1-10)</h4>
                  <button onClick={toggleAllDifficulties} style={styles.selectAllBtn}>
                    {selectedDifficulties.size === 10 ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div style={styles.chipGrid5}>
                  {ALL_DIFFICULTIES.map((level) => (
                    <label key={level} style={{ ...chip(selectedDifficulties.has(level)), justifyContent: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedDifficulties.has(level)}
                        onChange={() => toggleIn(selectedDifficulties, setSelectedDifficulties, level)}
                        style={styles.checkbox}
                      />
                      {level}
                    </label>
                  ))}
                </div>
              </div>

              <div style={styles.filterGroup}>
                <div style={styles.filterHeader}>
                  <h4 style={styles.filterTitle}>Accuracy</h4>
                  <button onClick={toggleAllAccuracy} style={styles.selectAllBtn}>
                    {selectedAccuracy.size === ACCURACY_BUCKETS.length ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div style={styles.chipGrid3}>
                  {ACCURACY_BUCKETS.map((b) => (
                    <label key={b.id} style={{ ...chip(selectedAccuracy.has(b.id)), justifyContent: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedAccuracy.has(b.id)}
                        onChange={() => toggleIn(selectedAccuracy, setSelectedAccuracy, b.id)}
                        style={styles.checkbox}
                      />
                      {b.label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={styles.filterGroup}>
                <h4 style={styles.filterTitle}>Word status</h4>
                <div style={styles.segmented}>
                  {[
                    ["both", "All"],
                    ["nonmastered", "Not mastered"],
                    ["mastered", "Mastered"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMasteredFilter(value)}
                      style={{ ...styles.segment, ...(masteredFilter === value ? styles.segmentActive : {}) }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button type="button" onClick={resetFilters} style={styles.resetButton}>
                Reset all filters
              </button>
            </div>
          )}

          {/* WORDS LIST */}
          {filteredWords.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: 44 }}>🔍</div>
              <p style={{ margin: "8px 0 4px", color: "white", fontWeight: 700 }}>No words match</p>
              <p style={{ margin: "0 0 16px" }}>Try a different search or loosen the filters.</p>
              <button type="button" onClick={resetFilters} style={styles.primaryButton}>Reset filters</button>
            </div>
          ) : (
            <>
              <div style={styles.tableHeader}>
                <button style={{ ...styles.thButton, textAlign: "left" }} onClick={() => sortByColumn("english")}>English{arrow("english")}</button>
                <button style={{ ...styles.thButton, textAlign: "left" }} onClick={() => sortByColumn("dutch")}>Dutch{arrow("dutch")}</button>
                <button style={styles.thButton} onClick={() => sortByColumn("mastery")}>Mastery{arrow("mastery")}</button>
                <button style={styles.thButton} onClick={() => sortByColumn("correct")} aria-label="Sort by correct answers">✅{arrow("correct")}</button>
                <button style={styles.thButton} onClick={() => sortByColumn("incorrect")} aria-label="Sort by wrong answers">❌{arrow("incorrect")}</button>
                <button style={styles.thButton} onClick={() => sortByColumn("difficulty")}>Level{arrow("difficulty")}</button>
              </div>

              <div style={styles.tableBody}>
                {filteredWords.map((progress) => (
                  <div
                    key={progress.word_id}
                    style={styles.tableRow}
                    role="button"
                    tabIndex={0}
                    onClick={() => openMistakes(progress)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openMistakes(progress);
                      }
                    }}
                  >
                    <div style={styles.colEnglish}>{progress.words.english}</div>
                    <div style={styles.colDutch}>{progress.words.dutch}</div>
                    <div style={styles.colCenter}>
                      <span
                        style={{
                          ...styles.masteryBadge,
                          backgroundColor: progress.mastered
                            ? "#22c55e"
                            : progress.masteryPercent >= 60
                            ? "#f97316"
                            : "#ef4444",
                        }}
                      >
                        {progress.mastered ? "✅" : `${progress.masteryPercent}%`}
                      </span>
                    </div>
                    <div style={styles.colCenter}>{progress.correct_count}</div>
                    <div style={styles.colCenter}>{progress.incorrect_count}</div>
                    <div style={styles.colCenter}>{progress.words.difficulty}</div>
                  </div>
                ))}
              </div>

              <div style={styles.resultCounter}>
                Showing {filteredWords.length} of {stats.total} words
              </div>
              <div style={styles.tapHint}>Tap a word to see your past mistakes</div>
            </>
          )}
        </div>
      </div>

      {/* BACK TO TOP */}
      {showTop && (
        <button type="button" onClick={scrollToTop} style={styles.topButton} aria-label="Back to top">
          ↑
        </button>
      )}

      {/* MISTAKES POP-UP */}
      {selectedWord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mistakes-title"
          style={styles.modalOverlay}
          onClick={closeMistakes}
        >
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button style={styles.modalClose} onClick={closeMistakes} aria-label="Close">✕</button>
            <p style={styles.modalEyebrow}>WORD HISTORY</p>
            <h2 id="mistakes-title" style={styles.modalTitle}>{selectedWord.words.english}</h2>
            <div style={styles.modalDutchBox}>
              <span style={styles.modalDutchLabel}>CORRECT ANSWER</span>
              <strong style={styles.modalDutch}>{selectedWord.words.dutch}</strong>
            </div>
            <div style={styles.modalStats}>
              <span>✅ {selectedWord.correct_count}</span>
              <span>❌ {selectedWord.incorrect_count}</span>
              <span>{selectedWord.mastered ? "🏅 Mastered" : `📊 ${selectedWord.masteryPercent}%`}</span>
            </div>

            <h3 style={styles.modalSectionTitle}>
              Previous mistakes{mistakes.length > 0 ? ` (${mistakes.length})` : ""}
            </h3>

            {mistakesLoading ? (
              <p style={styles.modalMuted}>Loading…</p>
            ) : mistakesError ? (
              <p style={styles.modalError}>⚠️ {mistakesError}</p>
            ) : mistakes.length === 0 ? (
              <p style={styles.modalMuted}>No mistakes recorded for this word yet. Wrong answers are saved from now on.</p>
            ) : (
              <div style={styles.mistakeList}>
                {mistakes.map((m) => (
                  <div key={m.id} style={styles.mistakeRow}>
                    <div style={styles.mistakeAnswer}>
                      {m.user_answer && m.user_answer.trim() ? m.user_answer : <em>No answer entered</em>}
                    </div>
                    <div style={styles.mistakeMeta}>
                      {formatDateTime(m.created_at)}
                      {m.mode ? ` · ${m.mode}` : ""}
                      {m.level ? ` · level ${m.level}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const GRID_COLS = "2fr 2fr 1.2fr 0.8fr 0.8fr 0.9fr";

const styles = {
  // The screen itself never scrolls: header stays put, only .scrollArea moves
  shell: {
    position: "fixed",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    fontFamily: FONT,
    overflow: "hidden",
  },
  header: {
    flex: "0 0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    padding: "max(12px, env(safe-area-inset-top)) 16px 12px",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    borderBottom: "1px solid rgba(6,182,212,0.2)",
    zIndex: 100,
  },
  title: {
    fontSize: "clamp(20px, 5vw, 28px)",
    fontWeight: "800",
    margin: 0,
    color: "white",
    textShadow: "0 2px 8px rgba(6,182,212,0.3)",
    whiteSpace: "nowrap",
  },
  backButton: {
    padding: "9px 14px",
    backgroundColor: "#06b6d4",
    color: "#0f172a",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "700",
    fontFamily: "inherit",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  scrollArea: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    overscrollBehavior: "contain",
  },
  inner: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "14px 16px max(24px, env(safe-area-inset-bottom))",
    boxSizing: "border-box",
    width: "100%",
  },
  centerState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    color: "#06b6d4",
    padding: "40px 20px",
    fontSize: "16px",
  },
  primaryButton: {
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: "700",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
  },

  // ---------- Stats ----------
  statsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
    marginBottom: "12px",
  },
  statCard: {
    background: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
    border: "1px solid rgba(6,182,212,0.2)",
    borderRadius: "10px",
    padding: "10px",
    textAlign: "center",
    color: "white",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  },
  statValue: { fontSize: "clamp(20px, 4vw, 26px)", fontWeight: "bold", color: "#fbbf24", margin: "0 0 2px" },
  statLabel: { fontSize: "clamp(10px, 2vw, 12px)", color: "#bfdbfe", margin: 0, textTransform: "uppercase", fontWeight: "600" },

  // ---------- Search / sort / filters ----------
  searchInput: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: "8px",
    border: "1px solid rgba(6,182,212,0.3)",
    background: "rgba(255,255,255,0.95)",
    color: "#0f172a",
    fontSize: "16px",
    fontFamily: "inherit",
    boxSizing: "border-box",
    marginBottom: "10px",
  },
  sortRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" },
  sortLabel: { color: "#93c5fd", fontSize: "13px", fontWeight: "600", flexShrink: 0 },
  sortSelect: {
    flex: 1,
    minWidth: 0,
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid rgba(6,182,212,0.4)",
    background: "rgba(30,58,138,0.8)",
    color: "white",
    fontSize: "16px",
    fontFamily: "inherit",
  },
  filterToggle: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "11px 14px",
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    fontFamily: "inherit",
    cursor: "pointer",
    color: "#bfdbfe",
  },
  filtersContent: {
    marginTop: "8px",
    background: "rgba(30, 58, 138, 0.8)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "10px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  filterGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  filterHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" },
  filterTitle: { fontSize: "13px", color: "#67e8f9", margin: 0, fontWeight: "700" },
  selectAllBtn: {
    padding: "5px 10px",
    fontSize: "12px",
    background: "#06b6d4",
    color: "#0f172a",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },
  chipGrid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
  chipGrid3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" },
  chipGrid5: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" },
  chip: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "8px",
    background: "rgba(30, 58, 138, 0.4)",
    color: "#bfdbfe",
    fontSize: "13px",
    cursor: "pointer",
    userSelect: "none",
    transition: "all 0.2s ease",
  },
  chipActive: { background: "rgba(6,182,212,0.15)", borderColor: "#06b6d4", color: "white" },
  checkbox: { width: "14px", height: "14px", cursor: "pointer", accentColor: "#06b6d4", flexShrink: 0 },
  segmented: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" },
  segment: {
    padding: "10px 6px",
    fontSize: "13px",
    fontWeight: "600",
    fontFamily: "inherit",
    color: "#bfdbfe",
    background: "rgba(30, 58, 138, 0.4)",
    border: "1px solid rgba(6,182,212,0.3)",
    borderRadius: "8px",
    cursor: "pointer",
  },
  segmentActive: {
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    borderColor: "transparent",
    color: "white",
  },
  resetButton: {
    padding: "10px",
    fontSize: "13px",
    fontWeight: "600",
    fontFamily: "inherit",
    color: "#fca5a5",
    background: "transparent",
    border: "1px solid rgba(248,113,113,0.4)",
    borderRadius: "8px",
    cursor: "pointer",
  },

  // ---------- Table ----------
  tableHeader: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "grid",
    gridTemplateColumns: GRID_COLS,
    gap: "8px",
    marginTop: "12px",
    padding: "4px 12px",
    background: "#14285e",
    borderRadius: "8px 8px 0 0",
    borderBottom: "2px solid rgba(6,182,212,0.4)",
    alignItems: "center",
  },
  thButton: {
    padding: "10px 0",
    background: "none",
    border: "none",
    color: "#67e8f9",
    fontWeight: "700",
    fontSize: "clamp(10px, 2.4vw, 12px)",
    fontFamily: "inherit",
    textAlign: "center",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tableBody: { display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" },
  tableRow: {
    display: "grid",
    gridTemplateColumns: GRID_COLS,
    gap: "8px",
    padding: "12px",
    background: "linear-gradient(135deg, rgba(30, 58, 138, 0.6) 0%, rgba(124, 58, 237, 0.3) 100%)",
    border: "1px solid rgba(6,182,212,0.15)",
    borderRadius: "6px",
    alignItems: "center",
    fontSize: "clamp(11px, 2.5vw, 13px)",
    color: "#bfdbfe",
    cursor: "pointer",
  },
  colEnglish: { fontWeight: "600", color: "#f0f9ff", overflowWrap: "anywhere" },
  colDutch: { overflowWrap: "anywhere" },
  colCenter: { display: "flex", justifyContent: "center", alignItems: "center", fontWeight: "600" },
  masteryBadge: {
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "clamp(10px, 2vw, 11px)",
    fontWeight: "bold",
    color: "white",
    minWidth: "42px",
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  emptyState: { textAlign: "center", color: "#93c5fd", padding: "40px 20px", fontSize: "14px" },
  resultCounter: { textAlign: "center", color: "#bfdbfe", fontSize: "12px", padding: "14px 0 2px", fontWeight: "500" },
  tapHint: { textAlign: "center", color: "#93c5fd", fontSize: "11px" },

  // ---------- Back to top ----------
  topButton: {
    position: "fixed",
    right: "16px",
    bottom: "max(18px, env(safe-area-inset-bottom))",
    width: "46px",
    height: "46px",
    borderRadius: "50%",
    border: "none",
    background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    color: "white",
    fontSize: "22px",
    fontWeight: "800",
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
    zIndex: 150,
  },

  // ---------- Pop-up ----------
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "max(18px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom))",
    background: "rgba(2, 6, 23, 0.82)",
    backdropFilter: "blur(8px)",
  },
  modalCard: {
    position: "relative",
    width: "100%",
    maxWidth: "440px",
    maxHeight: "100%",
    overflowY: "auto",
    boxSizing: "border-box",
    padding: "26px 20px 20px",
    borderRadius: "24px",
    color: "#f8fafc",
    background: "linear-gradient(160deg, #1e293b 0%, #172554 100%)",
    border: "1px solid rgba(148,163,184,0.35)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
  },
  modalClose: {
    position: "absolute",
    top: "12px",
    right: "12px",
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    border: "1px solid rgba(148,163,184,0.4)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontSize: "15px",
  },
  modalEyebrow: { margin: "0 0 4px", color: "#67e8f9", fontSize: "11px", fontWeight: 900, letterSpacing: "2px" },
  modalTitle: { margin: "0 0 12px", fontSize: "26px", fontWeight: 850, lineHeight: 1.2, paddingRight: "36px", overflowWrap: "anywhere" },
  modalDutchBox: { display: "flex", flexDirection: "column", gap: "5px", padding: "12px 14px", borderRadius: "14px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(52,211,153,0.5)" },
  modalDutchLabel: { color: "#6ee7b7", fontSize: "10px", fontWeight: 900, letterSpacing: "1.5px" },
  modalDutch: { color: "#ecfdf5", fontSize: "22px", overflowWrap: "anywhere" },
  modalStats: { display: "flex", justifyContent: "space-around", gap: "8px", margin: "14px 0 4px", fontSize: "14px", fontWeight: 700, color: "#bfdbfe" },
  modalSectionTitle: { margin: "16px 0 10px", fontSize: "13px", fontWeight: 800, color: "#fca5a5", textTransform: "uppercase", letterSpacing: "0.5px" },
  modalMuted: { margin: 0, color: "#93c5fd", fontSize: "14px", lineHeight: 1.5 },
  modalError: { margin: 0, color: "#fde68a", fontSize: "13px", lineHeight: 1.5, overflowWrap: "anywhere" },
  mistakeList: { display: "flex", flexDirection: "column", gap: "8px" },
  mistakeRow: { padding: "10px 12px", borderRadius: "10px", background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.3)" },
  mistakeAnswer: { fontSize: "16px", fontWeight: 700, color: "#fecaca", overflowWrap: "anywhere" },
  mistakeMeta: { marginTop: "3px", fontSize: "11px", color: "#cbd5e1", textTransform: "capitalize" },
};

export default YourWords;
