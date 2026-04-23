import React, { useState } from "react";
import { useTheme } from "../../context/ThemeContext";

const COLORS = {
  DDoS: "#dc2626", DoS: "#ef4444", PortScan: "#f97316",
  BruteForce: "#eab308", WebAttack: "#a855f7", Botnet: "#ec4899",
};

function riskLevel(count, threshold) {
  const ratio = count / threshold;
  if (ratio >= 3) return { label: "HIGH", color: "#ef4444" };
  if (ratio >= 1.5) return { label: "MED", color: "#f97316" };
  return { label: "LOW", color: "#eab308" };
}

export default function AlertHistoryPanel({ history, onClear }) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(true);

  return (
    <div style={{ background: tokens.bgCard, borderRadius: "12px", border: `1px solid ${tokens.border}` }}>
      {/* 헤더 (클릭으로 접기/펼치기) */}
      <div
        onClick={() => setOpen((p) => !p)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "13px", color: tokens.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            경보 히스토리
          </h3>
          {history.length > 0 && (
            <span style={{
              background: "#ef4444", color: "#fff", borderRadius: "999px",
              fontSize: "10px", fontWeight: 700, padding: "1px 7px", lineHeight: "16px",
            }}>
              {history.length}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {history.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              style={{
                fontSize: "11px", color: tokens.textMuted, background: "none",
                border: `1px solid ${tokens.border}`, borderRadius: "4px",
                cursor: "pointer", padding: "2px 8px",
              }}
            >
              모두 지우기
            </button>
          )}
          <span style={{ color: tokens.textDim, fontSize: "12px" }}>{open ? "▾" : "▸"}</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${tokens.border}`, maxHeight: "300px", overflowY: "auto" }}>
          {history.length === 0 ? (
            <div style={{ padding: "28px", textAlign: "center", color: tokens.textDim, fontSize: "13px" }}>
              탐지된 경보 없음
            </div>
          ) : (
            history.map((a, i) => {
              const color = COLORS[a.label] || "#ef4444";
              const risk  = riskLevel(a.count, a.threshold);
              return (
                <div
                  key={a.id ?? i}
                  style={{
                    padding: "11px 20px",
                    borderBottom: `1px solid ${tokens.borderLight}`,
                    borderLeft: `3px solid ${color}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color }}>
                        🚨 {a.label}
                      </span>
                      <span style={{
                        padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700,
                        background: `${risk.color}22`, color: risk.color,
                      }}>
                        {risk.label}
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", color: tokens.textDim, fontFamily: "monospace" }}>
                      {new Date(a.timestamp).toLocaleTimeString("ko-KR")}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: tokens.textMuted }}>
                    {a.windowSec}초 내 <strong style={{ color: tokens.textPrimary }}>{a.count}건</strong> 탐지
                    <span style={{ color: tokens.textDim }}> (임계값: {a.threshold}건)</span>
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
