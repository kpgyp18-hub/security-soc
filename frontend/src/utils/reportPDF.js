const LABEL_COLORS = {
  BENIGN:     "#22c55e",
  DoS:        "#ef4444",
  DDoS:       "#dc2626",
  PortScan:   "#f97316",
  BruteForce: "#eab308",
  WebAttack:  "#a855f7",
  Botnet:     "#ec4899",
};

function bar(pct, color) {
  return `
    <div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;width:100%">
      <div style="height:100%;width:${pct.toFixed(1)}%;background:${color};border-radius:3px"></div>
    </div>`;
}

function badge(label) {
  const color = LABEL_COLORS[label] || "#94a3b8";
  return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;background:${color}22;color:${color}">${label}</span>`;
}

function statusDot(ok) {
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ok ? "#22c55e" : "#ef4444"};margin-right:6px"></span>`;
}

export function printReportPDF({ stats, health, rangeLabel, total, attacks, attackRate, topAttack }) {
  const now = new Date().toLocaleString("ko-KR");
  const sortedStats = [...stats].sort((a, b) => Number(b.count) - Number(a.count));

  const statRows = sortedStats.map((s, i) => {
    const pct = total > 0 ? (Number(s.count) / total) * 100 : 0;
    const color = LABEL_COLORS[s.label] || "#94a3b8";
    return `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"}">
        <td style="padding:10px 12px">${badge(s.label)}</td>
        <td style="padding:10px 12px;font-weight:700;color:#0f172a">${Number(s.count).toLocaleString()}</td>
        <td style="padding:10px 12px;color:#475569">${pct.toFixed(1)}%</td>
        <td style="padding:10px 12px;width:140px">${bar(pct, color)}</td>
      </tr>`;
  }).join("");

  const healthRows = health ? [
    ["DB 전체 이벤트",  `${Number(health.db?.totalEvents ?? 0).toLocaleString()}건`, null],
    ["ML 서버 상태",    health.mlServer?.status === "ok" ? `정상 (${health.mlServer.latencyMs}ms)` : "오류", health.mlServer?.status === "ok"],
    ["모델 로드 여부",  health.mlServer?.modelLoaded ? "로드됨" : "미로드", health.mlServer?.modelLoaded],
    ["마지막 이벤트",   health.db?.lastEvent ? new Date(health.db.lastEvent).toLocaleString("ko-KR") : "—", null],
  ].map(([label, value, ok]) => `
    <tr>
      <td style="padding:9px 12px;color:#64748b;width:140px">${label}</td>
      <td style="padding:9px 12px;font-weight:600;color:${ok === null ? "#0f172a" : ok ? "#22c55e" : "#ef4444"}">
        ${ok !== null ? statusDot(ok) : ""}${value}
      </td>
    </tr>`).join("")
  : `<tr><td colspan="2" style="padding:16px;color:#94a3b8">시스템 정보 없음</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>보안 리포트 — Security SOC</title>
  <style>
    @page { size: A4; margin: 20mm 18mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Apple SD Gothic Neo", "Noto Sans KR", "맑은 고딕", sans-serif;
      color: #0f172a; background: #fff; margin: 0; padding: 0; font-size: 13px;
    }
    h2 { margin: 0 0 4px; font-size: 20px; font-weight: 800; color: #0f172a; }
    h3 { margin: 0 0 14px; font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: .05em; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 9px 12px; font-size: 11px; font-weight: 700; color: #64748b;
         border-bottom: 2px solid #e2e8f0; text-transform: uppercase; letter-spacing: .04em; }
    td { border-bottom: 1px solid #f1f5f9; vertical-align: middle; font-size: 13px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; }
    .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 24px; }
    .summary-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 18px; }
    .summary-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
    .summary-value { font-size: 22px; font-weight: 800; margin-bottom: 3px; }
    .summary-sub { font-size: 11px; color: #94a3b8; }
    .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <!-- 헤더 -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #3b82f6">
    <div>
      <div style="font-size:11px;color:#3b82f6;font-weight:700;letter-spacing:.08em;margin-bottom:6px">SECURITY SOC</div>
      <h2>보안 탐지 리포트</h2>
      <div style="font-size:12px;color:#64748b;margin-top:4px">기간: ${rangeLabel}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#94a3b8">생성 일시</div>
      <div style="font-size:12px;color:#475569;font-weight:600;margin-top:2px">${now}</div>
    </div>
  </div>

  <!-- 요약 카드 -->
  <div class="grid4">
    <div class="summary-card" style="border-top:3px solid #3b82f6">
      <div class="summary-label">전체 이벤트</div>
      <div class="summary-value" style="color:#3b82f6">${total.toLocaleString()}</div>
      <div class="summary-sub">${rangeLabel}</div>
    </div>
    <div class="summary-card" style="border-top:3px solid #ef4444">
      <div class="summary-label">공격 탐지</div>
      <div class="summary-value" style="color:#ef4444">${attacks.toLocaleString()}</div>
      <div class="summary-sub">공격률 ${attackRate}%</div>
    </div>
    <div class="summary-card" style="border-top:3px solid #22c55e">
      <div class="summary-label">정상 트래픽</div>
      <div class="summary-value" style="color:#22c55e">${(total - attacks).toLocaleString()}</div>
      <div class="summary-sub">정상률 ${total > 0 ? (100 - Number(attackRate)).toFixed(1) : 0}%</div>
    </div>
    <div class="summary-card" style="border-top:3px solid ${LABEL_COLORS[topAttack?.label] || "#94a3b8"}">
      <div class="summary-label">최다 공격 유형</div>
      <div class="summary-value" style="color:${LABEL_COLORS[topAttack?.label] || "#94a3b8"};font-size:18px">${topAttack?.label ?? "—"}</div>
      <div class="summary-sub">${topAttack ? `${Number(topAttack.count).toLocaleString()}건` : "없음"}</div>
    </div>
  </div>

  <!-- 공격 유형 집계 + 시스템 정보 -->
  <div class="grid2">
    <div class="card">
      <h3>공격 유형별 집계</h3>
      <table>
        <thead><tr>
          <th>유형</th><th>건수</th><th>비율</th><th>구성</th>
        </tr></thead>
        <tbody>${statRows || `<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8">데이터 없음</td></tr>`}</tbody>
      </table>
    </div>
    <div class="card">
      <h3>시스템 정보</h3>
      <table>
        <tbody>
          ${healthRows}
          <tr>
            <td style="padding:9px 12px;color:#64748b">리포트 기준</td>
            <td style="padding:9px 12px;font-weight:600;color:#0f172a">${rangeLabel}</td>
          </tr>
          <tr>
            <td style="padding:9px 12px;color:#64748b">생성 시각</td>
            <td style="padding:9px 12px;font-weight:600;color:#0f172a">${now}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- 안내 -->
  <div class="card" style="background:#eff6ff;border-color:#bfdbfe">
    <p style="margin:0;font-size:12px;color:#1e40af;line-height:1.7">
      이 리포트는 <strong>Security SOC</strong> 대시보드에서 자동 생성되었습니다.
      XGBoost 모델(CICIDS2017 학습)을 사용하여 네트워크 트래픽을 분류하였으며,
      탐지 기간은 <strong>${rangeLabel}</strong>입니다.
    </p>
  </div>

  <div class="footer">
    <span>Security SOC — 네트워크 침입 탐지 시스템</span>
    <span>${now}</span>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요."); return; }
  win.document.write(html);
  win.document.close();
  win.addEventListener("load", () => {
    setTimeout(() => win.print(), 300);
  });
}
