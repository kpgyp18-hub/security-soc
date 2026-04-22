import React, { useMemo } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useTheme } from "../../context/ThemeContext";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const ATTACK_TYPES = ["DoS", "DDoS", "PortScan", "BruteForce", "WebAttack", "Botnet"];

export default function TrafficChart({ data, labelColors }) {
  const { tokens } = useTheme();
  const labels = useMemo(() => data.map((d) => d.time), [data]);

  const activeAttacks = useMemo(() =>
    ATTACK_TYPES.filter((t) => data.some((d) => d.label === t)), [data]);

  const benignDataset = useMemo(() => ({
    label: "BENIGN",
    data: data.map((d) => (d.label === "BENIGN" ? d.value : null)),
    borderColor: "rgba(34,197,94,0.5)",
    backgroundColor: "rgba(34,197,94,0.06)",
    borderWidth: 1.5,
    pointRadius: 0,
    pointHoverRadius: 4,
    spanGaps: true,
    fill: true,
    tension: 0.4,
    order: 10,
  }), [data]);

  const attackDatasets = useMemo(() =>
    ATTACK_TYPES.map((type) => {
      const color = labelColors[type] || "#ef4444";
      return {
        label: type,
        data: data.map((d) => (d.label === type ? d.value : null)),
        borderColor: color,
        backgroundColor: color,
        pointRadius: data.map((d) => (d.label === type ? 7 : 0)),
        pointHoverRadius: data.map((d) => (d.label === type ? 10 : 0)),
        pointBackgroundColor: color,
        pointBorderColor: tokens.bgBase,
        pointBorderWidth: 1.5,
        showLine: false,
        spanGaps: false,
        fill: false,
        order: 1,
      };
    }), [data, labelColors, tokens.bgBase]);

  const chartData = { labels, datasets: [benignDataset, ...attackDatasets] };

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 150 },
    interaction: { mode: "nearest", intersect: false, axis: "x" },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        borderWidth: 1,
        titleColor: tokens.tooltipTitle,
        bodyColor: tokens.tooltipBody,
        padding: 10,
        callbacks: {
          title: (items) => items[0]?.label ?? "",
          label: (ctx) => {
            const item = data[ctx.dataIndex];
            if (!item || item.value == null) return null;
            const bps  = Math.round(item.value);
            const unit = bps >= 1_000_000 ? `${(bps / 1_000_000).toFixed(2)} MB/s`
                       : bps >= 1_000     ? `${(bps / 1_000).toFixed(1)} KB/s`
                       : `${bps} B/s`;
            return `  ${item.label}  •  ${unit}`;
          },
          labelColor: (ctx) => {
            const item = data[ctx.dataIndex];
            const color = item ? (labelColors[item.label] || "#94a3b8") : "#94a3b8";
            return { borderColor: color, backgroundColor: color, borderWidth: 2, borderRadius: 3 };
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: tokens.textDim, maxTicksLimit: 8, font: { size: 11 } },
        grid: { color: tokens.gridColor, drawBorder: false },
        border: { color: tokens.axisColor },
      },
      y: {
        ticks: {
          color: tokens.textDim,
          font: { size: 11 },
          callback: (v) => {
            if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
            if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
            return v;
          },
        },
        grid: { color: tokens.gridColor, drawBorder: false },
        border: { color: tokens.axisColor },
        beginAtZero: true,
      },
    },
  }), [data, tokens, labelColors]);

  const recentAttacks = useMemo(() => {
    const recent = data.slice(-10);
    return ATTACK_TYPES
      .map((t) => ({ type: t, count: recent.filter((d) => d.label === t).length }))
      .filter((a) => a.count > 0);
  }, [data]);

  return (
    <div style={{ background: tokens.bgCard, borderRadius: "12px", padding: "20px", border: `1px solid ${tokens.border}`, transition: "background 0.2s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "14px", color: tokens.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            실시간 트래픽
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: "11px", color: tokens.textDim }}>
            최근 {data.length}개 플로우 · Flow bytes/s
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
          <LegendItem color="rgba(34,197,94,0.7)" label="BENIGN" dot={false} tokens={tokens} active />
          {ATTACK_TYPES.map((t) => (
            <LegendItem key={t} color={labelColors[t] || "#ef4444"} label={t} active={activeAttacks.includes(t)} tokens={tokens} dot />
          ))}
        </div>
      </div>

      <div style={{ height: "300px" }}>
        {data.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: tokens.textDim, fontSize: "13px" }}>
            데이터 수집 중…
          </div>
        ) : (
          <Line data={chartData} options={options} />
        )}
      </div>

      {recentAttacks.length > 0 && (
        <div style={{ marginTop: "14px", padding: "10px 14px", background: tokens.bgDeep, borderRadius: "8px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", color: tokens.textDim, whiteSpace: "nowrap" }}>최근 10플로우</span>
          {recentAttacks.map(({ type, count }) => (
            <span key={type} style={{ fontSize: "11px", fontWeight: 700, color: labelColors[type] || "#ef4444", background: `${labelColors[type] || "#ef4444"}18`, padding: "2px 8px", borderRadius: "999px", border: `1px solid ${labelColors[type] || "#ef4444"}44` }}>
              {type} ×{count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label, dot, active, tokens }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px", opacity: active ? 1 : 0.3, transition: "opacity 0.3s" }}>
      {dot
        ? <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
        : <span style={{ width: "14px", height: "2px", background: color, display: "inline-block", borderRadius: "1px", flexShrink: 0 }} />
      }
      <span style={{ fontSize: "11px", color: tokens.textMuted }}>{label}</span>
    </div>
  );
}
