import React, { useEffect, useState } from "react";
import useWebSocket from "../hooks/useWebSocket";
import TrafficChart from "../components/TrafficChart/TrafficChart";
import AlertTable   from "../components/AlertTable/AlertTable";
import AlertToast   from "../components/AlertToast/AlertToast";
import HealthPanel  from "../components/HealthPanel/HealthPanel";
import { useTheme } from "../context/ThemeContext";

const LABEL_COLORS = {
  BENIGN:     "#22c55e",
  DoS:        "#ef4444",
  DDoS:       "#dc2626",
  PortScan:   "#f97316",
  BruteForce: "#eab308",
  WebAttack:  "#a855f7",
  Botnet:     "#ec4899",
};

const WS_URL    = `ws://${window.location.hostname}:4000`;
const MAX_TOASTS = 4;
const TOAST_TTL  = 8000;

export default function MonitoringPage() {
  const { tokens } = useTheme();
  const { lastEvent, lastAlert, connected } = useWebSocket(WS_URL);
  const [events,    setEvents]    = useState([]);
  const [stats,     setStats]     = useState([]);
  const [chartData, setChartData] = useState([]);
  const [toasts,    setToasts]    = useState([]);

  useEffect(() => {
    fetch("/api/events?limit=200").then((r) => r.json()).then(setEvents).catch(() => {});
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (!lastEvent) return;
    setEvents((prev) => [lastEvent, ...prev].slice(0, 500));
    setStats((prev) => {
      const found = prev.find((s) => s.label === lastEvent.label);
      if (found) return prev.map((s) => s.label === lastEvent.label ? { ...s, count: String(Number(s.count) + 1) } : s);
      return [...prev, { label: lastEvent.label, count: "1" }];
    });
    setChartData((prev) => [...prev.slice(-59), {
      time:  new Date(lastEvent.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      label: lastEvent.label,
      value: lastEvent.flow_bytes_per_sec,
    }]);
  }, [lastEvent]);

  useEffect(() => {
    if (!lastAlert) return;
    setToasts((prev) => [lastAlert, ...prev].slice(0, MAX_TOASTS));
    const id = setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== lastAlert.id)), TOAST_TTL);
    return () => clearTimeout(id);
  }, [lastAlert]);

  const totalCount  = stats.reduce((acc, s) => acc + Number(s.count), 0);
  const attackCount = stats.filter((s) => s.label !== "BENIGN").reduce((acc, s) => acc + Number(s.count), 0);

  return (
    <>
      <AlertToast alerts={toasts} />
      <div style={{ padding: "28px", maxWidth: "1300px" }}>

        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: tokens.textPrimary }}>실시간 모니터링</h1>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: tokens.textMuted }}>네트워크 트래픽 이상 탐지 현황</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: connected ? "#22c55e" : "#ef4444",
              boxShadow: connected ? "0 0 6px #22c55e" : "none" }} />
            <span style={{ fontSize: "13px", color: connected ? "#22c55e" : "#ef4444" }}>
              {connected ? "실시간 연결 중" : "연결 끊김"}
            </span>
          </div>
        </div>

        {/* 요약 카드 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <StatCard label="전체 이벤트" value={totalCount.toLocaleString()} color="#3b82f6" tokens={tokens} />
          <StatCard label="공격 탐지"   value={attackCount.toLocaleString()} color="#ef4444" tokens={tokens} />
          <StatCard label="정상 트래픽" value={(totalCount - attackCount).toLocaleString()} color="#22c55e" tokens={tokens} />
          {stats.filter((s) => s.label !== "BENIGN").sort((a, b) => Number(b.count) - Number(a.count)).slice(0, 3).map((s) => (
            <StatCard key={s.label} label={s.label} value={Number(s.count).toLocaleString()} color={LABEL_COLORS[s.label] || "#94a3b8"} tokens={tokens} />
          ))}
        </div>

        {/* 차트 */}
        <div style={{ marginBottom: "24px" }}>
          <TrafficChart data={chartData} labelColors={LABEL_COLORS} />
        </div>

        {/* 분포 + 헬스 + 테이블 */}
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <DistributionCard stats={stats} totalCount={totalCount} tokens={tokens} labelColors={LABEL_COLORS} />
            <HealthPanel wsConnected={connected} />
          </div>
          <AlertTable events={events} labelColors={LABEL_COLORS} />
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, color, tokens }) {
  return (
    <div style={{ background: tokens.bgCard, borderRadius: "12px", padding: "18px 20px", borderLeft: `3px solid ${color}`, border: `1px solid ${tokens.border}`, borderLeftWidth: "3px", borderLeftColor: color }}>
      <p style={{ margin: "0 0 6px", fontSize: "11px", color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ margin: 0, fontSize: "26px", fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

function DistributionCard({ stats, totalCount, tokens, labelColors }) {
  return (
    <div style={{ background: tokens.bgCard, borderRadius: "12px", padding: "20px", border: `1px solid ${tokens.border}` }}>
      <h3 style={{ margin: "0 0 16px", fontSize: "13px", color: tokens.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>공격 유형 분포</h3>
      {stats.length === 0 ? <p style={{ color: tokens.textDim, fontSize: "13px" }}>데이터 없음</p> : (
        stats.sort((a, b) => Number(b.count) - Number(a.count)).map((s) => {
          const pct = totalCount > 0 ? (Number(s.count) / totalCount) * 100 : 0;
          return (
            <div key={s.label} style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "13px", color: labelColors[s.label] || tokens.textSecondary }}>{s.label}</span>
                <span style={{ fontSize: "13px", color: tokens.textSecondary }}>{Number(s.count).toLocaleString()}</span>
              </div>
              <div style={{ height: "6px", background: tokens.border, borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: labelColors[s.label] || tokens.textSecondary, borderRadius: "3px", transition: "width 0.3s" }} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
