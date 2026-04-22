// db.js의 insertEvent, getEvents, getStats를 pg.Pool 모킹으로 단위 테스트

jest.mock("pg", () => {
  const query = jest.fn();
  const Pool = jest.fn(() => ({ query }));
  return { Pool };
});

const { Pool } = require("pg");
const mockQuery = Pool().query;

// 모킹 후 모듈 로드
const { insertEvent, getEvents, getStats } = require("../../db");

beforeEach(() => {
  mockQuery.mockReset();
  // initDB 호출 시 테이블 생성 쿼리는 항상 성공
  mockQuery.mockResolvedValue({ rows: [] });
});

describe("insertEvent", () => {
  const sampleEvent = {
    label: "DoS",
    confidence: 0.98,
    probabilities: { DoS: 0.98, BENIGN: 0.02 },
    flow_duration: 100000,
    total_fwd_packets: 1000,
    total_bwd_packets: 5,
    flow_bytes_per_sec: 300000,
    flow_packets_per_sec: 2000,
    fwd_packet_len_mean: 40,
    bwd_packet_len_mean: 10,
    syn_flag_count: 1,
    ack_flag_count: 2,
    psh_flag_count: 50,
    rst_flag_count: 1,
    fin_flag_count: 0,
    avg_packet_size: 35,
  };

  test("INSERT 쿼리를 올바른 파라미터로 호출한다", async () => {
    const savedRow = { id: 1, ...sampleEvent, timestamp: new Date().toISOString() };
    mockQuery.mockResolvedValueOnce({ rows: [savedRow] });

    const result = await insertEvent(sampleEvent);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO traffic_events/);
    expect(params[0]).toBe("DoS");
    expect(params[1]).toBe(0.98);
    expect(params[2]).toBe(JSON.stringify({ DoS: 0.98, BENIGN: 0.02 }));
    expect(result).toEqual(savedRow);
  });

  test("DB 오류 발생 시 예외를 던진다", async () => {
    mockQuery.mockRejectedValueOnce(new Error("connection refused"));
    await expect(insertEvent(sampleEvent)).rejects.toThrow("connection refused");
  });
});

describe("getEvents", () => {
  test("기본값(limit=50, offset=0)으로 쿼리한다", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getEvents();

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/SELECT \* FROM traffic_events/);
    expect(sql).toMatch(/ORDER BY timestamp DESC/);
    expect(params).toContain(50);
    expect(params).toContain(0);
  });

  test("label 필터가 있으면 WHERE 절이 추가된다", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getEvents({ label: "DDoS", limit: 10, offset: 0 });

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/WHERE label = /);
    expect(params).toContain("DDoS");
  });

  test("rows 배열을 반환한다", async () => {
    const fakeRows = [{ id: 1, label: "BENIGN" }, { id: 2, label: "DoS" }];
    mockQuery.mockResolvedValueOnce({ rows: fakeRows });

    const result = await getEvents();
    expect(result).toEqual(fakeRows);
  });
});

describe("getStats", () => {
  test("GROUP BY label 쿼리를 실행한다", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getStats();

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/GROUP BY label/);
    expect(sql).toMatch(/COUNT\(\*\)/);
  });

  test("집계 결과를 반환한다", async () => {
    const fakeStats = [
      { label: "BENIGN", count: "100" },
      { label: "DoS", count: "20" },
    ];
    mockQuery.mockResolvedValueOnce({ rows: fakeStats });

    const result = await getStats();
    expect(result).toEqual(fakeStats);
  });
});
