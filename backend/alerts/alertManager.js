const axios = require("axios");

// 임계값 규칙: windowSec 초 안에 count 회 이상이면 알림
const ALERT_RULES = [
  { label: "DDoS",       threshold: 5,  windowSec: 60 },
  { label: "DoS",        threshold: 10, windowSec: 60 },
  { label: "PortScan",   threshold: 15, windowSec: 60 },
  { label: "BruteForce", threshold: 5,  windowSec: 60 },
  { label: "WebAttack",  threshold: 3,  windowSec: 60 },
  { label: "Botnet",     threshold: 3,  windowSec: 60 },
];

function getAlertRules() {
  return ALERT_RULES.map((r) => ({ ...r }));
}

function updateAlertRule(label, updates) {
  const rule = ALERT_RULES.find((r) => r.label === label);
  if (!rule) return false;
  if (updates.threshold !== undefined) rule.threshold = Math.max(1, parseInt(updates.threshold));
  if (updates.windowSec !== undefined) rule.windowSec = Math.max(10, parseInt(updates.windowSec));
  // 규칙이 바뀌면 해당 레이블의 슬라이딩 윈도우 초기화
  if (windows[label]) windows[label] = [];
  return true;
}

// 레이블별 최근 이벤트 타임스탬프 슬라이딩 윈도우
const windows = {};

// 마지막 알림 시각 (같은 레이블로 30초 내 중복 알림 방지)
const lastAlertAt = {};
const COOLDOWN_SEC = 30;

let broadcastFn = null;

function setBroadcast(fn) {
  broadcastFn = fn;
}

function check(label) {
  const rule = ALERT_RULES.find((r) => r.label === label);
  if (!rule) return;

  const now = Date.now();
  if (!windows[label]) windows[label] = [];

  // 윈도우 밖 항목 제거
  windows[label].push(now);
  windows[label] = windows[label].filter((t) => now - t < rule.windowSec * 1000);

  const count = windows[label].length;
  if (count < rule.threshold) return;

  // 쿨다운 체크
  if (lastAlertAt[label] && now - lastAlertAt[label] < COOLDOWN_SEC * 1000) return;
  lastAlertAt[label] = now;

  const alert = {
    label,
    count,
    windowSec: rule.windowSec,
    threshold: rule.threshold,
    timestamp: new Date().toISOString(),
    message: `[SOC 경보] ${label} ${count}건 / ${rule.windowSec}초`,
  };

  console.warn(`[ALERT] ${alert.message}`);

  // WebSocket 브로드캐스트
  if (broadcastFn) {
    broadcastFn({ type: "alert", data: alert });
  }

  // Slack 전송
  sendSlack(alert).catch(() => {});
}

async function sendSlack(alert) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const colorMap = {
    DDoS: "#dc2626", DoS: "#ef4444", PortScan: "#f97316",
    BruteForce: "#eab308", WebAttack: "#a855f7", Botnet: "#ec4899",
  };

  await axios.post(webhookUrl, {
    attachments: [
      {
        color: colorMap[alert.label] || "#ef4444",
        title: `🚨 SOC 경보 — ${alert.label} 급증`,
        text: `최근 *${alert.windowSec}초* 안에 *${alert.count}건* 탐지 (임계값: ${alert.threshold}건)`,
        footer: `Security SOC • ${new Date(alert.timestamp).toLocaleString("ko-KR")}`,
      },
    ],
  });
}

module.exports = { check, setBroadcast, getAlertRules, updateAlertRule };
