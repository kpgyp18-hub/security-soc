import React, { useEffect } from "react";

const HIGH_RISK = new Set(["DDoS", "DoS", "BruteForce"]);

const COLORS = {
  DDoS: "#dc2626", DoS: "#ef4444", BruteForce: "#eab308",
  WebAttack: "#a855f7", Botnet: "#ec4899", PortScan: "#f97316",
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

export default function CriticalAlertModal({ alert, onDismiss }) {
  useEffect(() => {
    if (!alert) return;
    beep();
    const id = setInterval(beep, 1500);
    return () => clearInterval(id);
  }, [alert]);

  if (!alert || !HIGH_RISK.has(alert.label)) return null;

  const color = COLORS[alert.label] || "#ef4444";
  const rgb   = hexToRgb(color);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "critBg 0.9s ease-in-out infinite alternate",
    }}>
      <style>{`
        @keyframes critBg {
          from { background: rgba(0,0,0,0.88); }
          to   { background: rgba(${rgb},0.22); }
        }
        @keyframes critGlow {
          from { box-shadow: 0 0 40px ${color}44; }
          to   { box-shadow: 0 0 80px ${color}99; }
        }
      `}</style>

      <div style={{
        background: "#0f172a",
        border: `2px solid ${color}`,
        borderRadius: "16px",
        padding: "44px 52px",
        textAlign: "center",
        maxWidth: "500px",
        width: "90vw",
        animation: "critGlow 0.9s ease-in-out infinite alternate",
      }}>
        <div style={{ fontSize: "60px", marginBottom: "12px" }}>🚨</div>

        <h1 style={{ margin: "0 0 6px", fontSize: "30px", fontWeight: 900, color, letterSpacing: "-0.5px" }}>
          위험 경보
        </h1>
        <h2 style={{ margin: "0 0 24px", fontSize: "22px", fontWeight: 700, color: "#f1f5f9" }}>
          {alert.label} 공격 탐지
        </h2>

        <div style={{
          background: `rgba(${rgb},0.1)`,
          border: `1px solid rgba(${rgb},0.3)`,
          borderRadius: "10px",
          padding: "18px 20px",
          marginBottom: "28px",
        }}>
          <p style={{ margin: "0 0 6px", fontSize: "18px", color: "#f1f5f9" }}>
            <strong style={{ color, fontSize: "22px" }}>{alert.count}건</strong> 탐지
          </p>
          <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#94a3b8" }}>
            최근 {alert.windowSec}초 내 · 임계값 <strong>{alert.threshold}건</strong> 초과
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#475569" }}>
            {new Date(alert.timestamp).toLocaleString("ko-KR")}
          </p>
        </div>

        <button
          onClick={onDismiss}
          style={{
            padding: "13px 48px",
            borderRadius: "10px",
            border: "none",
            background: color,
            color: "#fff",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
        >
          확인
        </button>
      </div>
    </div>
  );
}
