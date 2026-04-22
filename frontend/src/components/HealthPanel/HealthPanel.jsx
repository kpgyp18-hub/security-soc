import React, { useEffect, useState, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";

export default function HealthPanel({ wsConnected }) {
  const { tokens } = useTheme();
  const [health,  setHealth]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastOk,  setLastOk]  = useState(null);

  const fetchHealth = useCallback(() => {
    setLoading(true);
    fetch("/api/health")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { setHealth(data); setLastOk(new Date()); setLoading(false); })
      .catch((err) => { console.warn("[HealthPanel]", err.message); setLoading(false); setTimeout(fetchHealth, 5000); });
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, 30_000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  const dbOk = health?.db?.status === "ok";
  const mlOk = health?.mlServer?.status === "ok";

  return (
    <div style={{ background: tokens.bgCard, borderRadius: "12px", padding: "16px 20px", border: `1px solid ${tokens.border}`, transition: "background 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <h3 style={{ margin: 0, fontSize: "13px", color: tokens.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          시스템 상태
        </h3>
        <button onClick={fetchHealth} title="새로고침"
          style={{ background: "none", border: "none", cursor: "pointer", color: loading ? tokens.textDim : tokens.textMuted, fontSize: "15px", padding: "2px 4px" }}>
          {loading ? "⏳" : "↻"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <Row label="WebSocket" ok={wsConnected} pending={false} value={wsConnected ? "연결됨" : "끊김"} tokens={tokens} />
        <Row label="ML 서버"   ok={mlOk} pending={loading && !health}
          value={loading && !health ? "확인 중…" : mlOk ? `${health.mlServer.latencyMs}ms` : "오류"} tokens={tokens} />
        <Row label="데이터베이스" ok={dbOk} pending={loading && !health}
          value={loading && !health ? "확인 중…" : dbOk ? `${Number(health.db.totalEvents).toLocaleString()}건` : "오류"} tokens={tokens} />
      </div>

      {dbOk && health?.db?.lastEvent && (
        <div style={{ fontSize: "11px", color: tokens.textDim, marginTop: "10px", borderTop: `1px solid ${tokens.border}`, paddingTop: "8px" }}>
          마지막 이벤트: {new Date(health.db.lastEvent).toLocaleTimeString("ko-KR")}
        </div>
      )}
      {lastOk && (
        <div style={{ fontSize: "11px", color: tokens.border, marginTop: "4px" }}>
          갱신: {lastOk.toLocaleTimeString("ko-KR")}
        </div>
      )}
    </div>
  );
}

function Dot({ ok, pending }) {
  return (
    <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", marginRight: "8px", flexShrink: 0,
      background: pending ? "#f59e0b" : ok ? "#22c55e" : "#ef4444" }} />
  );
}

function Row({ label, ok, pending, value, tokens }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", fontSize: "13px", color: tokens.textSecondary }}>
        <Dot ok={ok} pending={pending} />{label}
      </div>
      <span style={{ fontSize: "12px", fontWeight: 600, color: pending ? "#f59e0b" : ok ? "#22c55e" : "#ef4444" }}>
        {value}
      </span>
    </div>
  );
}
