import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";

const STEPS = [
  { key: "load",    label: "[1/4] CSV 로드",     match: /\[1\/4\]/ },
  { key: "clean",   label: "[2/4] 데이터 정제",   match: /\[2\/4\]/ },
  { key: "balance", label: "[3/4] 불균형 처리",   match: /\[3\/4\]/ },
  { key: "train",   label: "[4/4] 모델 학습",     match: /\[4\/4\]/ },
  { key: "done",    label: "완료",               match: /메트릭 저장 완료/ },
];

export default function RetrainPage() {
  const { tokens } = useTheme();
  const [running,   setRunning]   = useState(false);
  const [logs,      setLogs]      = useState([]);
  const [result,    setResult]    = useState(null); // { success, message }
  const [stepIdx,   setStepIdx]   = useState(-1);
  const logEndRef = useRef(null);
  const esRef     = useRef(null);

  const appendLog = useCallback((line, isErr = false) => {
    setLogs((prev) => [...prev.slice(-500), { line, isErr, ts: Date.now() }]);
    const step = STEPS.findIndex((s) => s.match.test(line));
    if (step >= 0) setStepIdx(step);
  }, []);

  const startRetrain = useCallback(() => {
    setRunning(true);
    setLogs([]);
    setResult(null);
    setStepIdx(-1);

    fetch("/api/retrain/start", { method: "POST" })
      .then((res) => {
        const reader = res.body.getReader();
        const dec    = new TextDecoder();
        let buf = "";

        const pump = () =>
          reader.read().then(({ done, value }) => {
            if (done) { setRunning(false); return; }
            buf += dec.decode(value, { stream: true });
            const parts = buf.split("\n\n");
            buf = parts.pop();
            parts.forEach((part) => {
              const line = part.replace(/^data: /, "").trim();
              if (!line) return;
              try {
                const msg = JSON.parse(line);
                if (msg.type === "log")  appendLog(msg.data.line, msg.data.isErr);
                if (msg.type === "start") appendLog(msg.data.message);
                if (msg.type === "done") {
                  setResult(msg.data);
                  setRunning(false);
                  if (msg.data.success) setStepIdx(STEPS.length - 1);
                }
              } catch (_) {}
            });
            pump();
          });
        pump();
      })
      .catch((err) => {
        appendLog(`연결 오류: ${err.message}`, true);
        setRunning(false);
      });
  }, [appendLog]);

  const stopRetrain = useCallback(() => {
    fetch("/api/retrain/stop", { method: "POST" })
      .then(() => setRunning(false))
      .catch(() => setRunning(false));
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div style={{ padding: "28px", maxWidth: "900px" }}>
      {/* 헤더 */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: tokens.textPrimary }}>모델 재학습</h1>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: tokens.textMuted }}>
          CICIDS2017 데이터셋으로 XGBoost 모델을 재학습합니다. 완료 후 ML 서버가 새 모델을 자동 적용합니다.
        </p>
      </div>

      {/* 진행 단계 */}
      <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "12px", padding: "20px 24px", marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "13px", color: tokens.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>학습 단계</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
          {STEPS.map((s, i) => {
            const done    = stepIdx >= i;
            const active  = stepIdx === i && running;
            const color   = done ? "#22c55e" : active ? "#3b82f6" : tokens.border;
            return (
              <React.Fragment key={s.key}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "90px" }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: done ? "#22c55e" : active ? "#3b82f6" : tokens.bgDeep,
                    border: `2px solid ${color}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", color: done || active ? "#fff" : tokens.textDim,
                    transition: "all 0.3s",
                    boxShadow: active ? "0 0 0 4px rgba(59,130,246,0.2)" : "none",
                  }}>
                    {done && !active ? "✓" : i + 1}
                  </div>
                  <span style={{ fontSize: "10px", color: done ? "#22c55e" : active ? "#3b82f6" : tokens.textDim, textAlign: "center", lineHeight: 1.3, whiteSpace: "pre-wrap" }}>
                    {s.label.replace(/\[.+?\] /, "")}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: "2px", background: stepIdx > i ? "#22c55e" : tokens.border, transition: "background 0.3s", marginBottom: "20px" }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 시작/중단 버튼 + 결과 */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
        <button
          onClick={running ? stopRetrain : startRetrain}
          style={{
            padding: "10px 28px", borderRadius: "8px", border: "none",
            fontSize: "14px", fontWeight: 700, cursor: "pointer",
            background: running ? "#ef4444" : "#3b82f6",
            color: "#fff",
            transition: "opacity 0.15s",
          }}
        >
          {running ? "⏹ 중단" : "▶ 재학습 시작"}
        </button>

        {running && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: "#3b82f6", animation: "pulse 1s infinite" }} />
            <span style={{ fontSize: "13px", color: "#3b82f6" }}>학습 진행 중...</span>
          </div>
        )}

        {result && !running && (
          <div style={{
            padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
            background: result.success ? "#22c55e18" : "#ef444418",
            color: result.success ? "#22c55e" : "#ef4444",
            border: `1px solid ${result.success ? "#22c55e44" : "#ef444444"}`,
          }}>
            {result.success ? "✓" : "✕"} {result.message}
          </div>
        )}
      </div>

      {/* 로그 창 */}
      <div style={{ background: "#0d1117", borderRadius: "12px", border: `1px solid ${tokens.border}`, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${tokens.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "#8b949e", fontFamily: "monospace" }}>stdout / stderr</span>
          <button onClick={() => setLogs([])} style={{ background: "none", border: "none", color: "#8b949e", fontSize: "11px", cursor: "pointer" }}>
            지우기
          </button>
        </div>
        <div style={{ height: "400px", overflowY: "auto", padding: "12px 16px", fontFamily: "monospace", fontSize: "12px", lineHeight: 1.6 }}>
          {logs.length === 0 ? (
            <span style={{ color: "#484f58" }}>재학습을 시작하면 로그가 여기에 출력됩니다.</span>
          ) : (
            logs.map((entry, i) => (
              <div key={i} style={{ color: entry.isErr ? "#f85149" : "#e6edf3", marginBottom: "1px" }}>
                {entry.line}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* 안내 */}
      <div style={{ marginTop: "20px", background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "12px", padding: "16px 20px" }}>
        <p style={{ margin: 0, fontSize: "13px", color: tokens.textSecondary, lineHeight: 1.7 }}>
          ⚠️ <strong style={{ color: tokens.textPrimary }}>데이터셋 필요:</strong> 재학습은{" "}
          <code style={{ background: tokens.bgDeep, padding: "1px 5px", borderRadius: "4px", fontSize: "12px" }}>
            ml-server/data/MachineLearningCSV/MachineLearningCVE/
          </code>{" "}
          폴더에 CICIDS2017 CSV 파일이 있어야 합니다. 학습 완료 후 ML 서버를 재시작해야 새 모델이 적용됩니다.
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
