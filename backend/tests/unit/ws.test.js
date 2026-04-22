// websocket/ws.js 단위 테스트

const http = require("http");
const { initWebSocket, broadcast } = require("../../websocket/ws");

let server;

beforeAll((done) => {
  server = http.createServer();
  server.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

describe("initWebSocket", () => {
  test("실제 HTTP 서버에 WebSocketServer를 바인딩해도 오류가 없다", () => {
    expect(() => initWebSocket(server)).not.toThrow();
  });
});

describe("broadcast", () => {
  test("연결된 클라이언트가 없어도 오류가 발생하지 않는다", () => {
    const payload = { type: "traffic_event", data: { label: "BENIGN" } };
    expect(() => broadcast(payload)).not.toThrow();
  });

  test("JSON 직렬화 결과가 올바른 구조를 갖는다", () => {
    const payload = { type: "traffic_event", data: { id: 42, label: "DoS" } };
    const serialized = JSON.stringify(payload);
    const parsed = JSON.parse(serialized);

    expect(parsed.type).toBe("traffic_event");
    expect(parsed.data.label).toBe("DoS");
    expect(parsed.data.id).toBe(42);
  });

  test("다양한 payload 타입을 직렬화할 수 있다", () => {
    const payloads = [
      { type: "traffic_event", data: { label: "DDoS", confidence: 0.99 } },
      { type: "traffic_event", data: { label: "BENIGN", confidence: 0.98 } },
      { type: "ping" },
    ];
    payloads.forEach((p) => {
      expect(() => broadcast(p)).not.toThrow();
    });
  });
});
