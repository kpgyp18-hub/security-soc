import React, { useEffect, useState, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import DateRangePicker from "../components/DateRangePicker/DateRangePicker";
import { printReportPDF } from "../utils/reportPDF";

const LABEL_COLORS = {
  BENIGN:     "#22c55e",
  DoS:        "#ef4444",
  DDoS:       "#dc2626",
  PortScan:   "#f97316",
  BruteForce: "#eab308",
  WebAttack:  "#a855f7",
  Botnet:     "#ec4899",
};

const PERIODS = [
  { label: "오늘",     hours: 24 },
  { label: "최근 3일", hours: 72 },
  { label: "최근 7일", hours: 168 },
  { label: "전체",     hours: null },
];

export default function ReportPage() {
  const { tokens } = useTheme();
  const [period,    setPeriod]    = useState(PERIODS[0]);
  const [rangeFrom, setRangeFrom] = useState(null); // ISO | null
  const [rangeTo,   setRangeTo]   = useState(null); // ISO | null
  const [stats,     setStats]     = useState([]);
  const [hourly,    setHourly]    = useState([]);
  const [health,    setHealth]    = useState(null);
  const [exporting, setExporting] = useState(false);
  const [loading,   setLoading]   = useState(false);

  const isCustom = !!(rangeFrom || rangeTo);

  const resolveRange = useCallback(() => {
    if (isCustom) return { from: rangeFrom, to: rangeTo };
    const from = period.hours
      ? new Date(Date.now() - period.hours * 3_600_000).toISOString()
      : null;
    return { from, to: null };
  }, [isCustom, rangeFrom, rangeTo, period.hours]);

  const load = useCallback(() => {
    setLoading(true);
    const { from, to } = resolveRange();
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to)   p.set("to",   to);
    const q = p.toString() ? `?${p}` : "";
    Promise.all([
      fetch(`/api/stats${q}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/events/hourly${q}`).then((r) => r.json()).catch(() => []),
      fetch("/api/health").then((r) => r.json()).catch(() => null),
    ]).then(([s, h, hl]) => {
      setStats(Array.isArray(s) ? s : []);
      setHourly(h);
      setHealth(hl);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [resolveRange]);

  useEffect(() => { load(); }, [load]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { from, to } = resolveRange();
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to)   p.set("to",   to);
      const res  = await fetch(`/api/events/export?${p}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "report.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [resolveRange]);

  const selectPeriod = (p) => {
    setPeriod(p);
    setRangeFrom(null);
    setRangeTo(null);
  };

  const handleRangeChange = (from, to) => {
    setRangeFrom(from);
    setRangeTo(to);
  };

  const rangeLabel = isCustom
    ? (() => {
        const fmt = (iso) => {
          if (!iso) return null;
          const d = new Date(iso);
          return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
        };
        return `${fmt(rangeFrom) ?? "처음"} ~ ${fmt(rangeTo) ?? "현재"}`;
      })()
    : period.label;

  const total      = stats.reduce((s, r) => s + Number(r.count), 0);
  const attacks    = stats.filter((r) => r.label !== "BENIGN").reduce((s, r) => s + Number(r.count), 0);
  const attackRate = total > 0 ? ((attacks / total) * 100).toFixed(1) : "0.0";
  const topAttack  = stats.filter((r) => r.label !== "BENIGN").sort((a, b) => Number(b.count) - Number(a.count))[0];

  return (
    <div style={{ padding: "28px", maxWidth: "1100px" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: tokens.textPrimary }}>보안 리포트</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: tokens.textMuted }}>탐지 통계 요약 및 데이터 내보내기</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignSelf: "flex-start" }}>
          <button onClick={() => printReportPDF({ stats, health, rangeLabel, total, attacks, attackRate, topAttack })}
            style={{ padding: "7px 16px", borderRadius: "8px", border: `1px solid ${tokens.border}`, background: tokens.bgCard, color: tokens.textSecondary, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            🖨 PDF
          </button>
          <button onClick={handleExport} disabled={exporting}
            style={{ padding: "7px 18px", borderRadius: "8px", border: "none", background: "#3b82f6", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: exporting ? "not-allowed" : "pointer", opacity: exporting ? 0.7 : 1 }}>
            {exporting ? "내보내는 중…" : "⬇ CSV"}
          </button>
        </div>
      </div>

      {/* 기간 필터 패널 */}
      <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "12px", padding: "16px 20px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        {/* 프리셋 버튼 */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {PERIODS.map((p) => {
            const active = !isCustom && period.label === p.label;
            return (
              <button key={p.label} onClick={() => selectPeriod(p)}
                style={{
                  padding: "5px 14px", borderRadius: "999px", border: "1px solid",
                  fontSize: "12px", cursor: "pointer",
                  borderColor: active ? "#3b82f6" : tokens.border,
                  background:  active ? "rgba(59,130,246,0.12)" : "transparent",
                  color:       active ? "#3b82f6" : tokens.textSecondary,
                  transition: "all 0.15s",
                }}>
                {p.label}
              </button>
            );
          })}
        </div>

        {/* 구분선 */}
        <div style={{ width: "1px", height: "24px", background: tokens.border, flexShrink: 0 }} />

        {/* 캘린더 범위 선택 */}
        <DateRangePicker
          from={rangeFrom}
          to={rangeTo}
          onChange={handleRangeChange}
          tokens={tokens}
        />

        {/* 현재 적용 중 표시 */}
        {isCustom && (
          <span style={{ fontSize: "11px", color: "#3b82f6" }}>● 직접 선택 적용 중</span>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: tokens.textMuted, padding: "60px" }}>데이터 불러오는 중…</div>
      ) : (
        <>
          {/* 요약 카드 4개 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
            <SummaryCard label="전체 이벤트"    value={total.toLocaleString()}             sub={rangeLabel}                                                                               color="#3b82f6"                              tokens={tokens} />
            <SummaryCard label="공격 탐지"      value={attacks.toLocaleString()}           sub={`공격률 ${attackRate}%`}                                                                  color="#ef4444"                              tokens={tokens} />
            <SummaryCard label="정상 트래픽"    value={(total - attacks).toLocaleString()} sub={`정상률 ${total > 0 ? (100 - Number(attackRate)).toFixed(1) : 0}%`}                      color="#22c55e"                              tokens={tokens} />
            <SummaryCard label="최다 공격 유형" value={topAttack?.label ?? "—"}           sub={topAttack ? `${Number(topAttack.count).toLocaleString()}건` : "없음"} color={LABEL_COLORS[topAttack?.label] || "#94a3b8"} tokens={tokens} />
          </div>

          {/* 공격 유형별 집계 + 시스템 정보 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
            <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "12px", padding: "24px" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: tokens.textPrimary, fontWeight: 600 }}>공격 유형별 집계</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr>
                    {["유형", "건수", "비율", "구성"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "구성" ? "center" : "left", color: tokens.textDim, fontWeight: 600, borderBottom: `1px solid ${tokens.border}`, fontSize: "12px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: tokens.textDim }}>데이터 없음</td></tr>
                  ) : (
                    stats.sort((a, b) => Number(b.count) - Number(a.count)).map((s, i) => {
                      const pct = total > 0 ? (Number(s.count) / total) * 100 : 0;
                      return (
                        <tr key={s.label} style={{ borderBottom: `1px solid ${tokens.borderLight}`, background: i % 2 === 0 ? "transparent" : tokens.bgStripe }}>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, background: `${LABEL_COLORS[s.label] || "#94a3b8"}22`, color: LABEL_COLORS[s.label] || "#94a3b8" }}>
                              {s.label}
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px", color: tokens.textPrimary, fontWeight: 600 }}>{Number(s.count).toLocaleString()}</td>
                          <td style={{ padding: "8px 10px", color: tokens.textSecondary }}>{pct.toFixed(1)}%</td>
                          <td style={{ padding: "8px 10px" }}>
                            <div style={{ height: "6px", background: tokens.border, borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: LABEL_COLORS[s.label] || "#94a3b8", borderRadius: "3px" }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "12px", padding: "24px" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: tokens.textPrimary, fontWeight: 600 }}>시스템 정보</h3>
              {health ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <InfoRow label="DB 전체 이벤트" value={`${Number(health.db?.totalEvents ?? 0).toLocaleString()}건`} tokens={tokens} />
                  <InfoRow label="ML 서버 응답"   value={health.mlServer?.status === "ok" ? `정상 (${health.mlServer.latencyMs}ms)` : "오류"} ok={health.mlServer?.status === "ok"} tokens={tokens} />
                  <InfoRow label="모델 로드"       value={health.mlServer?.modelLoaded ? "로드됨" : "미로드"} ok={health.mlServer?.modelLoaded} tokens={tokens} />
                  <InfoRow label="마지막 이벤트"   value={health.db?.lastEvent ? new Date(health.db.lastEvent).toLocaleString("ko-KR") : "—"} tokens={tokens} />
                  <InfoRow label="리포트 기준"     value={rangeLabel} tokens={tokens} />
                  <InfoRow label="생성 시각"       value={new Date().toLocaleString("ko-KR")} tokens={tokens} />
                </div>
              ) : (
                <p style={{ color: tokens.textDim, fontSize: "13px" }}>시스템 정보를 불러올 수 없습니다</p>
              )}
            </div>
          </div>

          {/* 안내 문구 */}
          <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "12px", padding: "20px 24px" }}>
            <p style={{ margin: 0, fontSize: "13px", color: tokens.textSecondary, lineHeight: 1.7 }}>
              📋 <strong style={{ color: tokens.textPrimary }}>CSV 내보내기</strong>를 사용하면 현재 기간({rangeLabel})의 전체 탐지 이벤트를 다운로드할 수 있습니다.
              Excel에서 바로 열 수 있으며, 피처값(패킷 수, 바이트, 플래그 등) 18개 컬럼이 포함됩니다.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, color, tokens }) {
  return (
    <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderTop: `3px solid ${color}`, borderRadius: "12px", padding: "20px" }}>
      <p style={{ margin: "0 0 6px", fontSize: "11px", color: tokens.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 700, color }}>{value}</p>
      <p style={{ margin: 0, fontSize: "12px", color: tokens.textDim }}>{sub}</p>
    </div>
  );
}

function InfoRow({ label, value, ok, tokens }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${tokens.borderLight}` }}>
      <span style={{ fontSize: "13px", color: tokens.textMuted }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 600, color: ok === undefined ? tokens.textPrimary : ok ? "#22c55e" : "#ef4444" }}>{value}</span>
    </div>
  );
}
