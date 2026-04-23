const express = require("express");
const { spawn } = require("child_process");
const path = require("path");

const router = express.Router();

const ML_DIR = path.resolve(__dirname, "../../ml-server");
let retrainProc = null;

// GET /api/retrain/status — 현재 재학습 프로세스 실행 여부
router.get("/status", (req, res) => {
  res.json({ running: retrainProc !== null });
});

// POST /api/retrain/start — 재학습 시작 (SSE 스트림)
router.post("/start", (req, res) => {
  if (retrainProc) {
    res.status(409).json({ error: "이미 재학습이 실행 중입니다." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  send("start", { message: "재학습 시작..." });

  // Python 실행: 시스템에 python3 또는 python 사용
  const pythonBin = process.platform === "win32" ? "python" : "python3";
  retrainProc = spawn(pythonBin, ["train.py"], {
    cwd: ML_DIR,
    env: { ...process.env },
  });

  retrainProc.stdout.on("data", (chunk) => {
    const lines = chunk.toString().split("\n").filter(Boolean);
    lines.forEach((line) => send("log", { line }));
  });

  retrainProc.stderr.on("data", (chunk) => {
    const lines = chunk.toString().split("\n").filter(Boolean);
    lines.forEach((line) => send("log", { line, isErr: true }));
  });

  retrainProc.on("close", (code) => {
    retrainProc = null;
    if (code === 0) {
      send("done", { success: true, message: "재학습 완료. 모델이 갱신되었습니다." });
    } else {
      send("done", { success: false, message: `재학습 실패 (exit ${code})` });
    }
    res.end();
  });

  retrainProc.on("error", (err) => {
    retrainProc = null;
    send("done", { success: false, message: `프로세스 오류: ${err.message}` });
    res.end();
  });

  req.on("close", () => {
    if (retrainProc) {
      retrainProc.kill();
      retrainProc = null;
    }
  });
});

// POST /api/retrain/stop — 재학습 강제 중단
router.post("/stop", (req, res) => {
  if (!retrainProc) {
    res.json({ stopped: false, message: "실행 중인 재학습이 없습니다." });
    return;
  }
  retrainProc.kill();
  retrainProc = null;
  res.json({ stopped: true });
});

module.exports = router;
