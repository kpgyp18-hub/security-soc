import React, { useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";

const LABELS = ["BENIGN", "DoS", "DDoS", "PortScan", "BruteForce", "WebAttack", "Botnet"];
const LABEL_COLORS = {
  BENIGN:     "#22c55e",
  DoS:        "#ef4444",
  DDoS:       "#dc2626",
  PortScan:   "#f97316",
  BruteForce: "#eab308",
  WebAttack:  "#a855f7",
  Botnet:     "#ec4899",
};
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function HourlyHeatmap({ data }) {
  const { tokens } = useTheme();

  const matrix = useMemo(() => {
    const map = {};
    LABELS.forEach((l) => { map[l] = Array(24).fill(0); });
    data.forEach((row) => {
      const h = new Date(row.hour).getHours();
      if (map[row.label]) map[row.label][h] += Number(row.count);
    });
    return map;
  }, [data]);

  const maxVal = useMemo(() => {
    let m = 1;
    LABELS.forEach((l) => { m = Math.max(m, ...matrix[l]); });
    return m;
  }, [matrix]);

  const [tooltip, setTooltip] = React.useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "12px", padding: "24px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "14px", color: tokens.textPrimary, fontWeight: 600 }}>시간대별 공격 히트맵</h3>
        <p style={{ color: tokens.textDim, fontSize: "13px" }}>데이터 없음</p>
      </div>
    );
  }

  return (
    <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "12px", padding: "24px" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: "14px", color: tokens.textPrimary, fontWeight: 600 }}>
        시간대별 공격 히트맵
      </h3>
      <p style={{ margin: "0 0 16px", fontSize: "12px", color: tokens.textMuted }}>
        셀 위에 마우스를 올리면 건수를 확인할 수 있습니다
      </p>

      <div style={{ overflowX: "auto", position: "relative" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: "3px", fontSize: "11px", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: "88px", textAlign: "left", paddingBottom: "6px", color: tokens.textDim, fontWeight: 400 }}>
                유형 \ 시
              </th>
              {HOURS.map((h) => (
                <th key={h} style={{
                  width: "26px", textAlign: "center", paddingBottom: "6px",
                  color: tokens.textDim, fontWeight: 400, fontSize: "10px",
                }}>
                  {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LABELS.map((label) => (
              <tr key={label}>
                <td style={{
                  paddingRight: "10px", paddingBottom: "3px",
                  color: LABEL_COLORS[label], fontWeight: 600,
                  whiteSpace: "nowrap", fontSize: "11px",
                }}>
                  {label}
                </td>
                {HOURS.map((h) => {
                  const val = matrix[label][h];
                  const intensity = val === 0 ? 0 : Math.max(0.12, val / maxVal);
                  const color = LABEL_COLORS[label];
                  return (
                    <td
                      key={h}
                      onMouseEnter={() => setTooltip({ label, h, val })}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        width: "26px", height: "26px", borderRadius: "4px",
                        background: val === 0 ? tokens.bgDeep : color,
                        opacity: val === 0 ? 1 : intensity,
                        cursor: val > 0 ? "default" : undefined,
                        transition: "opacity 0.15s",
                        border: tooltip?.label === label && tooltip?.h === h
                          ? `1.5px solid ${color}`
                          : "1.5px solid transparent",
                      }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* 툴팁 */}
        {tooltip && (
          <div style={{
            position: "fixed", pointerEvents: "none",
            background: tokens.bgCard, border: `1px solid ${LABEL_COLORS[tooltip.label]}`,
            borderRadius: "8px", padding: "6px 12px", fontSize: "12px",
            color: tokens.textPrimary, zIndex: 1000,
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            transform: "translate(12px, -50%)",
            top: "50%", left: "50%",
          }}>
            <span style={{ color: LABEL_COLORS[tooltip.label], fontWeight: 700 }}>{tooltip.label}</span>
            {" "}{String(tooltip.h).padStart(2, "0")}시: <strong>{tooltip.val}건</strong>
          </div>
        )}
      </div>

      {/* 범례 */}
      <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: tokens.textMuted }}>
        <span>낮음</span>
        <div style={{ display: "flex", gap: "2px" }}>
          {[0.12, 0.3, 0.5, 0.7, 1.0].map((o) => (
            <div key={o} style={{
              width: "18px", height: "10px", borderRadius: "2px",
              background: "#3b82f6", opacity: o,
            }} />
          ))}
        </div>
        <span>높음</span>
        <span style={{ marginLeft: "12px", color: tokens.border }}>|</span>
        <div style={{ display: "flex", gap: "2px" }}>
          <div style={{ width: "14px", height: "10px", borderRadius: "2px", background: tokens.bgDeep, border: `1px solid ${tokens.border}` }} />
        </div>
        <span>0건</span>
      </div>
    </div>
  );
}
