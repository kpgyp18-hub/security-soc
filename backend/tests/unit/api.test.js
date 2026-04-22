// routes/api.js 단위 테스트 - DB를 모킹해 라우트 핸들러만 검증

jest.mock("../../db", () => ({
  getEvents: jest.fn(),
  getStats: jest.fn(),
}));

const request = require("supertest");
const express = require("express");
const apiRouter = require("../../routes/api");
const { getEvents, getStats } = require("../../db");

const app = express();
app.use(express.json());
app.use("/api", apiRouter);

beforeEach(() => {
  getEvents.mockReset();
  getStats.mockReset();
});

describe("GET /api/events", () => {
  test("200 응답과 이벤트 배열을 반환한다", async () => {
    const fakeEvents = [
      { id: 1, label: "BENIGN", confidence: 0.99 },
      { id: 2, label: "DoS", confidence: 0.97 },
    ];
    getEvents.mockResolvedValue(fakeEvents);

    const res = await request(app).get("/api/events");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(fakeEvents);
    expect(getEvents).toHaveBeenCalledWith({ limit: 50, offset: 0, label: undefined });
  });

  test("limit/offset/label 쿼리파라미터를 파싱해 전달한다", async () => {
    getEvents.mockResolvedValue([]);

    await request(app).get("/api/events?limit=10&offset=5&label=DDoS");

    expect(getEvents).toHaveBeenCalledWith({ limit: 10, offset: 5, label: "DDoS" });
  });

  test("DB 오류 시 500을 반환한다", async () => {
    getEvents.mockRejectedValue(new Error("DB 연결 실패"));

    const res = await request(app).get("/api/events");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});

describe("GET /api/stats", () => {
  test("200 응답과 통계 배열을 반환한다", async () => {
    const fakeStats = [
      { label: "BENIGN", count: "80" },
      { label: "DoS", count: "15" },
      { label: "DDoS", count: "5" },
    ];
    getStats.mockResolvedValue(fakeStats);

    const res = await request(app).get("/api/stats");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(fakeStats);
  });

  test("빈 배열도 정상 반환한다", async () => {
    getStats.mockResolvedValue([]);

    const res = await request(app).get("/api/stats");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("DB 오류 시 500을 반환한다", async () => {
    getStats.mockRejectedValue(new Error("timeout"));

    const res = await request(app).get("/api/stats");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("timeout");
  });
});
