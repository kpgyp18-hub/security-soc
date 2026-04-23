import React, { useEffect, useState, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";

export default function HealthPanel({ wsConnected }) {
  const { tokens }  = useTheme();
  const [health,    setHealth]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [lastOk,    setLastOk]    = useState(null);
  const [metrics,   setMetrics]   = useState(null);
  const [showMetrics, setShowMetrics] = useState(false);

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

  const fetchMetrics = useCallback(() => {
    fetch("/api/model-metrics")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setMetrics)
      .catch(() => {});
  }, []);

  useEffect(() => { if (showMetrics && !metrics) fetchMetrics(); }, [showMetrics, metrics, fetchMetrics]);

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

      {/* 모델 성능 토글 */}
      <button
        onClick={() => setShowMetrics((p) => !p)}
        style={{ width: "100%", marginTop: "10px", padding: "5px", borderRadius: "6px", border: `1px solid ${tokens.border}`, background: "none", color: tokens.textMuted, fontSize: "11px", cursor: "pointer", textAlign: "center" }}
      >
        {showMetrics ? "▾ 모델 성능 숨기기" : "▸ 모델 성능 보기"}
      </button>

      {showMetrics && (
        <div style={{ marginTop: "10px", borderTop: `1px solid ${tokens.border}`, paddingTop: "10px" }}>
          {!metrics ? (
            <p style={{ fontSize: "11px", color: tokens.textDim, textAlign: "center" }}>
              train.py 실행 후 조회 가능
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {["BENIGN","DoS","DDoS","PortScan","BruteForce","WebAttack","Botnet"].map((cls) => {
                const m = metrics[cls];
                if (!m) return null;
                return (
                  <div key={cls} style={{ fontSize: "11px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                      <span style={{ color: tokens.textMuted }}>{cls}</span>
                      <span style={{ color: tokens.textSecondary }}>F1 {(m["f1-score"] * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ height: "4px", background: tokens.border, borderRadius: "2px" }}>
                      <div style={{ height: "100%", width: `${m["f1-score"] * 100}%`, background: "#3b82f6", borderRadius: "2px" }} />
                    </div>
                  </div>
                );
              })}
              {metrics.accuracy !== undefined && (
                <div style={{ marginTop: "4px", fontSize: "11px", color: tokens.textSecondary, textAlign: "right" }}>
                  전체 정확도 {(metrics.accuracy * 100).toFixed(1)}%
                </div>
              )}
            </div>
          )}
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
