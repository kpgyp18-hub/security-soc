import React, { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";

const COLORS = {
  DDoS: "#dc2626", DoS: "#ef4444", PortScan: "#f97316",
  BruteForce: "#eab308", WebAttack: "#a855f7", Botnet: "#ec4899",
};

export default function AlertToast({ alerts }) {
  return (
    <div style={{ position: "fixed", top: "24px", right: "24px", zIndex: 1000, display: "flex", flexDirection: "column", gap: "10px", pointerEvents: "none" }}>
      {alerts.map((a) => <Toast key={a.id} alert={a} />)}
    </div>
  );
}

function Toast({ alert }) {
  const { tokens } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const color = COLORS[alert.label] || "#ef4444";

  return (
    <div style={{
      background: tokens.bgCard,
      border: `1px solid ${color}`,
      borderLeft: `4px solid ${color}`,
      borderRadius: "10px",
      padding: "14px 18px",
      minWidth: "300px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      transform: visible ? "translateX(0)" : "translateX(120%)",
      opacity: visible ? 1 : 0,
      transition: "transform 0.3s ease, opacity 0.3s ease",
      pointerEvents: "auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <span style={{ fontSize: "16px" }}>🚨</span>
        <span style={{ fontWeight: 700, color, fontSize: "14px" }}>SOC 경보 — {alert.label}</span>
      </div>
      <p style={{ margin: 0, fontSize: "12px", color: tokens.textSecondary }}>
        {alert.windowSec}초 안에 <strong style={{ color: tokens.textPrimary }}>{alert.count}건</strong> 탐지 (임계값: {alert.threshold}건)
      </p>
      <p style={{ margin: "4px 0 0", fontSize: "11px", color: tokens.textDim }}>
        {new Date(alert.timestamp).toLocaleTimeString("ko-KR")}
      </p>
    </div>
  );
}
