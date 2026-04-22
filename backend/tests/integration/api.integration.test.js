// 실제 DB + Express 서버를 띄워 API 엔드포인트 통합 테스트
// 환경: PostgreSQL이 localhost:5432에서 실행 중이어야 함

const request = require("supertest");
const http = require("http");
const express = require("express");
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const { initDB, insertEvent, getEvents, getStats } = require("../../db");
const { initWebSocket } = require("../../websocket/ws");
const apiRouter = require("../../routes/api");

let server;
let app;

const SAMPLE_EVENT = {
  label: "PortScan",
  confidence: 0.95,
  probabilities: { PortScan: 0.95, BENIGN: 0.05 },
  flow_duration: 500,
  total_fwd_packets: 2,
  total_bwd_packets: 1,
  flow_bytes_per_sec: 100,
  flow_packets_per_sec: 5,
  fwd_packet_len_mean: 20,
  bwd_packet_len_mean: 15,
  syn_flag_count: 2,
  ack_flag_count: 1,
  psh_flag_count: 0,
  rst_flag_count: 2,
  fin_flag_count: 0,
  avg_packet_size: 18,
};

beforeAll(async () => {
  await initDB();

  app = express();
  app.use(express.json());
  app.use("/api", apiRouter);

  server = http.createServer(app);
  initWebSocket(server);
  await new Promise((resolve) => server.listen(0, resolve)); // 랜덤 포트 사용
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("통합 - GET /api/events", () => {
  test("이벤트를 DB에 저장 후 조회할 수 있다", async () => {
    await insertEvent(SAMPLE_EVENT);

    const res = await request(server).get("/api/events?limit=5");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const found = res.body.find((e) => e.label === "PortScan");
    expect(found).toBeDefined();
    expect(found.confidence).toBeCloseTo(0.95, 2);
  });

  test("label 필터가 정확히 동작한다", async () => {
    const res = await request(server).get("/api/events?label=PortScan&limit=10");

    expect(res.status).toBe(200);
    res.body.forEach((e) => expect(e.label).toBe("PortScan"));
  });

  test("limit 파라미터가 결과 수를 제한한다", async () => {
    // 여러 개 삽입
    await insertEvent({ ...SAMPLE_EVENT, label: "BENIGN", confidence: 0.99 });
    await insertEvent({ ...SAMPLE_EVENT, label: "BENIGN", confidence: 0.99 });

    const res = await request(server).get("/api/events?limit=1");

    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(1);
  });
});

describe("통합 - GET /api/stats", () => {
  test("label별 카운트를 반환한다", async () => {
    const res = await request(server).get("/api/stats");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const portScanStat = res.body.find((s) => s.label === "PortScan");
    expect(portScanStat).toBeDefined();
    expect(Number(portScanStat.count)).toBeGreaterThan(0);
  });

  test("응답 필드에 label과 count가 포함된다", async () => {
    const res = await request(server).get("/api/stats");

    expect(res.status).toBe(200);
    res.body.forEach((stat) => {
      expect(stat).toHaveProperty("label");
      expect(stat).toHaveProperty("count");
    });
  });
});
