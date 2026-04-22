import React, { useState, useCallback, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";

const LABELS      = ["ALL", "BENIGN", "DoS", "DDoS", "PortScan", "BruteForce", "WebAttack", "Botnet"];
const TIME_RANGES = [
  { label: "전체",   value: null },
  { label: "1시간",  value: 1 },
  { label: "6시간",  value: 6 },
  { label: "24시간", value: 24 },
];

function minuteKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function AlertTable({ events, labelColors }) {
  const { tokens } = useTheme();
  const [labelFilter, setLabelFilter] = useState("ALL");
  const [timeRange,   setTimeRange]   = useState(null);
  const [minConf,     setMinConf]     = useState(0);
  const [expanded,    setExpanded]    = useState({});  // groupKey → bool
  const [exporting,   setExporting]   = useState(false);

  const cutoff = timeRange ? Date.now() - timeRange * 3_600_000 : null;

  // 필터링
  const filtered = useMemo(() => events.filter((e) => {
    if (labelFilter !== "ALL" && e.label !== labelFilter) return false;
    if (cutoff && new Date(e.timestamp).getTime() < cutoff) return false;
    if (e.confidence < minConf / 100) return false;
    return true;
  }), [events, labelFilter, cutoff, minConf]);

  // 분 단위 그룹핑
  const groups = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      const key = `${minuteKey(e.timestamp)}__${e.label}`;
      if (!map[key]) map[key] = { key, minute: minuteKey(e.timestamp), label: e.label, events: [] };
      map[key].events.push(e);
    });

    return Object.values(map)
      .sort((a, b) => b.minute.localeCompare(a.minute))
      .map((g) => ({
        ...g,
        count:          g.events.length,
        avgConf:        g.events.reduce((s, e) => s + e.confidence, 0) / g.events.length,
        maxBytes:       Math.max(...g.events.map((e) => e.flow_bytes_per_sec)),
        maxPackets:     Math.max(...g.events.map((e) => e.flow_packets_per_sec)),
        totalSyn:       g.events.reduce((s, e) => s + (e.syn_flag_count || 0), 0),
      }));
  }, [filtered]);

  const toggleExpand = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (labelFilter !== "ALL") params.set("label", labelFilter);
      if (cutoff) params.set("from", new Date(cutoff).toISOString());
      if (minConf > 0) params.set("minConfidence", (minConf / 100).toFixed(2));
      const res  = await fetch(`/api/events/export?${params}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "events.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [labelFilter, cutoff, minConf]);

  const chip = (active, color) => ({
    padding: "3px 10px", borderRadius: "999px", border: "1px solid",
    fontSize: "11px", cursor: "pointer",
    borderColor: active ? (color || "#3b82f6") : tokens.border,
    background:  active ? `${color || "#3b82f6"}22` : "transparent",
    color:       active ? (color || "#3b82f6") : tokens.textMuted,
    transition: "all 0.15s",
  });

  return (
    <div style={{ background: tokens.bgCard, borderRadius: "12px", padding: "20px", overflow: "hidden", border: `1px solid ${tokens.border}` }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", color: tokens.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          탐지 이벤트 로그
          <span style={{ marginLeft: "8px", fontSize: "12px", color: tokens.textDim, fontWeight: 400, textTransform: "none" }}>
            {groups.length}개 그룹 · {filtered.length.toLocaleString()}건
          </span>
        </h3>
        <button onClick={handleExport} disabled={exporting}
          style={{ padding: "5px 14px", borderRadius: "6px", border: `1px solid ${tokens.border}`, background: tokens.bgInput, color: tokens.textSecondary, fontSize: "12px", cursor: exporting ? "not-allowed" : "pointer" }}>
          {exporting ? "내보내는 중…" : "⬇ CSV"}
        </button>
      </div>

      {/* 시간 범위 */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
        {TIME_RANGES.map((r) => (
          <button key={r.label} onClick={() => setTimeRange(r.value)} style={chip(timeRange === r.value, "#3b82f6")}>{r.label}</button>
        ))}
      </div>

      {/* 레이블 필터 */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
        {LABELS.map((l) => (
          <button key={l} onClick={() => setLabelFilter(l)} style={chip(labelFilter === l, labelColors[l])}>{l}</button>
        ))}
      </div>

      {/* 신뢰도 슬라이더 */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <span style={{ fontSize: "11px", color: tokens.textMuted, whiteSpace: "nowrap" }}>최소 신뢰도</span>
        <input type="range" min="0" max="99" value={minConf} onChange={(e) => setMinConf(Number(e.target.value))}
          style={{ flex: 1, accentColor: "#3b82f6" }} />
        <span style={{ fontSize: "12px", color: tokens.textSecondary, minWidth: "36px", textAlign: "right" }}>{minConf}%</span>
      </div>

      {/* 그룹 테이블 */}
      <div style={{ overflowX: "auto" }}>
        {groups.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: tokens.textDim, fontSize: "13px" }}>데이터 없음</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.border}` }}>
                {["", "시각(분)", "분류", "건수", "평균 신뢰도", "최대 Bytes/s", "SYN 합계"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: tokens.textDim, fontWeight: 600, whiteSpace: "nowrap", fontSize: "12px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.slice(0, 80).map((g) => (
                <GroupRow
                  key={g.key}
                  group={g}
                  expanded={!!expanded[g.key]}
                  onToggle={() => toggleExpand(g.key)}
                  labelColors={labelColors}
                  tokens={tokens}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function GroupRow({ group, expanded, onToggle, labelColors, tokens }) {
  const color = labelColors[group.label] || "#94a3b8";

  return (
    <>
      {/* 집계 행 */}
      <tr
        onClick={onToggle}
        style={{ borderBottom: `1px solid ${tokens.borderLight}`, cursor: "pointer", transition: "background 0.1s",
          background: expanded ? `${color}0a` : "transparent" }}
        onMouseEnter={(e) => e.currentTarget.style.background = `${color}0d`}
        onMouseLeave={(e) => e.currentTarget.style.background = expanded ? `${color}0a` : "transparent"}
      >
        {/* 펼치기 아이콘 */}
        <td style={{ padding: "9px 8px 9px 12px", color: tokens.textDim, fontSize: "11px", width: "20px" }}>
          {expanded ? "▾" : "▸"}
        </td>
        <td style={{ padding: "9px 12px", color: tokens.textMuted, whiteSpace: "nowrap", fontFamily: "monospace", fontSize: "12px" }}>
          {group.minute}
        </td>
        <td style={{ padding: "9px 12px" }}>
          <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: `${color}22`, color }}>
            {group.label}
          </span>
        </td>
        <td style={{ padding: "9px 12px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color, background: `${color}18`, padding: "1px 8px", borderRadius: "6px" }}>
            ×{group.count}
          </span>
        </td>
        <td style={{ padding: "9px 12px", color: tokens.textPrimary }}>
          {(group.avgConf * 100).toFixed(1)}%
        </td>
        <td style={{ padding: "9px 12px", color: tokens.textPrimary }}>
          {Math.round(group.maxBytes).toLocaleString()}
        </td>
        <td style={{ padding: "9px 12px", color: tokens.textPrimary }}>
          {group.totalSyn}
        </td>
      </tr>

      {/* 펼쳐진 상세 행 */}
      {expanded && group.events.map((e, i) => (
        <tr key={e.id ?? i} style={{ background: tokens.bgStripe, borderBottom: `1px solid ${tokens.borderLight}` }}>
          <td style={{ padding: "6px 8px 6px 28px" }} />
          <td style={{ padding: "6px 12px", color: tokens.textDim, fontSize: "11px", fontFamily: "monospace", whiteSpace: "nowrap" }}>
            {new Date(e.timestamp).toLocaleTimeString("ko-KR")}
          </td>
          <td style={{ padding: "6px 12px", color: tokens.textDim, fontSize: "11px" }}>—</td>
          <td style={{ padding: "6px 12px", color: tokens.textDim, fontSize: "11px" }}>1</td>
          <td style={{ padding: "6px 12px", color: tokens.textSecondary, fontSize: "11px" }}>
            {(e.confidence * 100).toFixed(1)}%
          </td>
          <td style={{ padding: "6px 12px", color: tokens.textSecondary, fontSize: "11px" }}>
            {Math.round(e.flow_bytes_per_sec).toLocaleString()}
          </td>
          <td style={{ padding: "6px 12px", color: tokens.textSecondary, fontSize: "11px" }}>
            {e.syn_flag_count}
          </td>
        </tr>
      ))}
    </>
  );
}
