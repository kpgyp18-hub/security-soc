import React, { useMemo } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { useTheme } from "../../context/ThemeContext";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ATTACK_LABELS = ["DoS", "DDoS", "PortScan", "BruteForce", "WebAttack", "Botnet"];
const LABEL_COLORS  = {
  DoS:        "#ef4444", DDoS:       "#dc2626", PortScan:   "#f97316",
  BruteForce: "#eab308", WebAttack:  "#a855f7", Botnet:     "#ec4899",
};

function linearTrend(values) {
  const n = values.length;
  if (n < 2) return null;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  values.forEach((v, i) => { num += (i - meanX) * (v - meanY); den += (i - meanX) ** 2; });
  if (den === 0) return null;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  return values.map((_, i) => Math.max(0, intercept + slope * i));
}

export default function TrendChart({ data }) {
  const { tokens } = useTheme();

  const { days, matrix, totalByDay, trend } = useMemo(() => {
    if (!data || data.length === 0) return { days: [], matrix: {}, totalByDay: [], trend: null };

    const daySet = new Set();
    const map    = {};

    data.forEach((row) => {
      const day = new Date(row.day || row.hour).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
      daySet.add(day);
      if (!map[row.label]) map[row.label] = {};
      map[row.label][day] = (map[row.label][day] || 0) + Number(row.count);
    });

    const sortedDays   = [...daySet].sort();
    const attackTotals = sortedDays.map((d) =>
      ATTACK_LABELS.reduce((s, l) => s + (map[l]?.[d] || 0), 0)
    );
    const trendLine = linearTrend(attackTotals);

    return { days: sortedDays, matrix: map, totalByDay: attackTotals, trend: trendLine };
  }, [data]);

  if (days.length === 0) {
    return (
      <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "12px", padding: "24px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "14px", color: tokens.textPrimary, fontWeight: 600 }}>공격 트렌드</h3>
        <p style={{ color: tokens.textDim, fontSize: "13px" }}>데이터 없음</p>
      </div>
    );
  }

  const delta = trend && days.length >= 2
    ? trend[trend.length - 1] - trend[0]
    : null;

  const chartData = {
    labels: days,
    datasets: [
      ...ATTACK_LABELS.map((label) => ({
        label,
        data: days.map((d) => matrix[label]?.[d] || 0),
        backgroundColor: `${LABEL_COLORS[label]}cc`,
        borderColor: LABEL_COLORS[label],
        borderWidth: 1,
        stack: "attacks",
      })),
      ...(trend ? [{
        label: "트렌드",
        data: trend,
        type: "line",
        borderColor: "#ffffff88",
        borderDash: [6, 3],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0.4,
        stack: undefined,
        order: -1,
      }] : []),
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: {
        labels: { color: tokens.textMuted, font: { size: 11 }, boxWidth: 12 },
      },
      tooltip: {
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        borderWidth: 1,
        titleColor: tokens.tooltipTitle,
        bodyColor: tokens.tooltipBody,
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: { color: tokens.textDim, font: { size: 11 } },
        grid: { color: tokens.gridColor },
        border: { color: tokens.axisColor },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { color: tokens.textDim, font: { size: 11 } },
        grid: { color: tokens.gridColor },
        border: { color: tokens.axisColor },
      },
    },
  };

  return (
    <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "12px", padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "14px", color: tokens.textPrimary, fontWeight: 600 }}>공격 트렌드</h3>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: tokens.textMuted }}>
            일별 공격 건수 · 점선: 선형 추세
          </p>
        </div>
        {delta !== null && (
          <div style={{
            padding: "6px 14px", borderRadius: "8px",
            background: delta > 0 ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
            border: `1px solid ${delta > 0 ? "#ef4444" : "#22c55e"}44`,
          }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: delta > 0 ? "#ef4444" : "#22c55e" }}>
              {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}건/일
            </span>
            <span style={{ marginLeft: "6px", fontSize: "11px", color: tokens.textMuted }}>
              {delta > 0 ? "증가 추세" : "감소 추세"}
            </span>
          </div>
        )}
      </div>
      <div style={{ height: "260px" }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
