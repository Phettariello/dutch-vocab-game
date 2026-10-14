import React from "react";

// Default = large logo (login / sign-up screens).
// compact = smaller, side-by-side logo (Home screen).
export default function AuthBrand({ compact = false }) {
  const brandStyle = compact ? { ...styles.brand, ...styles.brandCompact } : styles.brand;
  const iconStyle = compact ? { ...styles.icon, ...styles.iconCompact } : styles.icon;
  const wordmarkStyle = compact ? { ...styles.wordmark, ...styles.wordmarkCompact } : styles.wordmark;

  return (
    <div style={brandStyle} aria-label="Vocabulist">
      <img src="/icon-192.png" alt="" style={iconStyle} />
      <div style={wordmarkStyle}>VOCABULIST</div>
    </div>
  );
}

const styles = {
  brand: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 },
  icon: { width: 76, height: 76, objectFit: "contain", borderRadius: 20, marginBottom: 7 },
  wordmark: { color: "#fff", fontSize: 25, lineHeight: 1.05, fontWeight: 850, letterSpacing: "1.4px", textAlign: "center" },

  brandCompact: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 0 },
  iconCompact: { width: 44, height: 44, borderRadius: 12, marginBottom: 0 },
  wordmarkCompact: { fontSize: 22 },
};
