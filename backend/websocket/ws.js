const { WebSocketServer } = require("ws");

let wss = null;

function initWebSocket(server) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("WebSocket 클라이언트 연결");
    ws.on("close", () => console.log("WebSocket 클라이언트 연결 해제"));
  });

  console.log("WebSocket 서버 초기화 완료");
}

function broadcast(payload) {
  if (!wss) return;
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

module.exports = { initWebSocket, broadcast };
