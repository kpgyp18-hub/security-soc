require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");

const { initDB } = require("./db");
const { initWebSocket, broadcast } = require("./websocket/ws");
const { startProducer } = require("./kafka/producer");
const { startConsumer, setBroadcast } = require("./kafka/consumer");
const { startMaintenance } = require("./maintenance");
const apiRouter = require("./routes/api");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", apiRouter);

const server = http.createServer(app);
initWebSocket(server);

const PORT = process.env.PORT || 4000;

async function main() {
  await initDB();
  startMaintenance();
  setBroadcast(broadcast);
  await startConsumer();
  if (process.env.REAL_CAPTURE !== "true") {
    await startProducer(1000); // 시뮬레이션 모드: 1초마다 랜덤 트래픽 생성
  } else {
    console.log("실제 캡처 모드: capture.py가 Kafka에 직접 전송합니다.");
  }

  server.listen(PORT, () => {
    console.log(`백엔드 서버 실행 중: http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("서버 시작 실패:", err);
  process.exit(1);
});
