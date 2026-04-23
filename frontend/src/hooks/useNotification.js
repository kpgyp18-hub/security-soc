import { useEffect, useCallback } from "react";

const HIGH_RISK = new Set(["DDoS", "DoS", "BruteForce"]);

export default function useNotification() {
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const notify = useCallback((alert) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const isHighRisk = HIGH_RISK.has(alert.label);
    new Notification(`🚨 SOC ${isHighRisk ? "위험" : "경보"} — ${alert.label}`, {
      body: `${alert.windowSec}초 내 ${alert.count}건 탐지 (임계값: ${alert.threshold}건)`,
      tag: alert.label,
      requireInteraction: isHighRisk,
    });
  }, []);

  return { notify };
}
