import React from "react";

export default function AuthBrand() {
  return (
    <div style={styles.brand} aria-label="Vocabulist">
      <img src="/icon-192.png" alt="" style={styles.icon} />
      <div style={styles.wordmark}>VOCABULIST</div>
    </div>
  );
}

const styles = {
  brand: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 },
  icon: { width: 76, height: 76, objectFit: "contain", borderRadius: 20, marginBottom: 7 },
  wordmark: { color: "#fff", fontSize: 25, lineHeight: 1.05, fontWeight: 850, letterSpacing: "1.4px", textAlign: "center" },
};
