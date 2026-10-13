import React from "react";

export default function AuthBrand() {
  return (
    <div style={styles.brand} aria-label="Vocabulist">
      <div style={styles.mark} aria-hidden="true">
        <svg viewBox="0 0 48 48" width="34" height="34" fill="none">
          <path d="M9 12.5C14.2 10.8 19.3 11.5 24 15v23c-4.7-3.5-9.8-4.2-15-2.5v-23Z" fill="white" fillOpacity=".96" />
          <path d="M39 12.5C33.8 10.8 28.7 11.5 24 15v23c4.7-3.5 9.8-4.2 15-2.5v-23Z" fill="white" fillOpacity=".72" />
          <path d="m17 21 7 12 7-12" stroke="#2563EB" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M35.5 5.5v6M32.5 8.5h6" stroke="#A5F3FC" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
      <div style={styles.wordmark}>Vocabulist</div>
      <div style={styles.tagline}>Build your Dutch, one word at a time.</div>
    </div>
  );
}

const styles = {
  brand: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 },
  mark: { width: 62, height: 62, borderRadius: 19, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)", boxShadow: "0 10px 26px rgba(6, 182, 212, .22)", marginBottom: 12 },
  wordmark: { color: "#fff", fontSize: "clamp(27px, 5vw, 32px)", lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.8px" },
  tagline: { color: "#cbd5e1", fontSize: 13, marginTop: 8, textAlign: "center", lineHeight: 1.5 },
};
