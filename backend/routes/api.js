const express = require("express");
const axios = require("axios");
const { Pool } = require("pg");
const { getEvents, exportEvents, getStats, getIncidents, createIncident, updateIncident, deleteIncident } = require("../db");
const alertManager = require("../alerts/alertManager");

const router = express.Router();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ── 탐지 이벤트 목록 (시간범위·레이블·신뢰도 필터) ─────────────────────────
router.get("/events", async (req, res) => {
  try {
    const { limit = 100, offset = 0, label, from, to, minConfidence } = req.query;
    const events = await getEvents({
      limit: Math.min(parseInt(limit), 1000),
      offset: parseInt(offset),
      label: label || undefined,
      from: from || undefined,
      to: to || undefined,
      minConfidence: minConfidence !== undefined ? parseFloat(minConfidence) : undefined,
    });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CSV 내보내기 ──────────────────────────────────────────────────────────────
router.get("/events/export", async (req, res) => {
  try {
    const { label, from, to, minConfidence } = req.query;
    const rows = await exportEvents({
      label: label || undefined,
      from: from || undefined,
      to: to || undefined,
      minConfidence: minConfidence !== undefined ? parseFloat(minConfidence) : undefined,
    });

    const COLS = [
      "id", "timestamp", "label", "confidence",
      "flow_duration", "total_fwd_packets", "total_bwd_packets",
      "flow_bytes_per_sec", "flow_packets_per_sec",
      "fwd_packet_len_mean", "bwd_packet_len_mean",
      "syn_flag_count", "ack_flag_count", "psh_flag_count",
      "rst_flag_count", "fin_flag_count", "avg_packet_size",
    ];

    const escape = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csv = [
      COLS.join(","),
      ...rows.map((r) => COLS.map((c) => escape(r[c])).join(",")),
    ].join("\r\n");

    const filename = `soc_events_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("﻿" + csv); // BOM for Excel
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 공격 유형별 통계 ──────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const { from, to } = req.query;
    const stats = await getStats({ from, to });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 시간대별 집계 (리포트 페이지용) ──────────────────────────────────────────
router.get("/events/hourly", async (req, res) => {
  try {
    const { from, to } = req.query;
    const conditions = [];
    const params = [];
    if (from) { params.push(from); conditions.push(`timestamp >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`timestamp <= $${params.length}`); }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const result = await pool.query(
      `SELECT date_trunc('hour', timestamp) AS hour, label, COUNT(*) AS count
       FROM traffic_events ${where}
       GROUP BY hour, label ORDER BY hour ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 시스템 헬스 ───────────────────────────────────────────────────────────────
router.get("/health", async (req, res) => {
  const result = { timestamp: new Date().toISOString() };

  // DB 상태
  try {
    const r = await pool.query("SELECT COUNT(*) AS total, MAX(timestamp) AS last_event FROM traffic_events");
    result.db = { status: "ok", totalEvents: Number(r.rows[0].total), lastEvent: r.rows[0].last_event };
  } catch {
    result.db = { status: "error" };
  }

  // ML 서버 상태 + 응답시간
  try {
    const t0 = Date.now();
    const r = await axios.get(`${process.env.ML_SERVER_URL || "http://127.0.0.1:8000"}/health`, { timeout: 3000 });
    result.mlServer = { status: "ok", latencyMs: Date.now() - t0, modelLoaded: r.data.model_loaded };
  } catch {
    result.mlServer = { status: "error" };
  }

  res.json(result);
});

// ── 알림 임계값 규칙 ──────────────────────────────────────────────────────────
router.get("/alert-rules", (req, res) => {
  res.json(alertManager.getAlertRules());
});

router.put("/alert-rules/:label", (req, res) => {
  const { label }             = req.params;
  const { threshold, windowSec } = req.body;
  const ok = alertManager.updateAlertRule(label, { threshold, windowSec });
  if (!ok) return res.status(404).json({ error: "규칙을 찾을 수 없습니다." });
  res.json({ success: true, rules: alertManager.getAlertRules() });
});

// ── 일별 집계 (트렌드 분석) ───────────────────────────────────────────────────
router.get("/events/daily", async (req, res) => {
  try {
    const { from, to } = req.query;
    const conditions   = [];
    const params       = [];
    if (from) { params.push(from); conditions.push(`timestamp >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`timestamp <= $${params.length}`); }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const result = await pool.query(
      `SELECT date_trunc('day', timestamp) AS day, label, COUNT(*) AS count
       FROM traffic_events ${where}
       GROUP BY day, label ORDER BY day ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 인시던트 CRUD ──────────────────────────────────────────────────────────────
router.get("/incidents", async (req, res) => {
  try {
    const { status, label } = req.query;
    const data = await getIncidents({ status, label });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/incidents", async (req, res) => {
  try {
    const { event_id, label, severity, title, notes } = req.body;
    if (!label) return res.status(400).json({ error: "label은 필수입니다." });
    const row = await createIncident({ event_id, label, severity, title, notes });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/incidents/:id", async (req, res) => {
  try {
    const id  = parseInt(req.params.id);
    const row = await updateIncident(id, req.body);
    if (!row) return res.status(404).json({ error: "인시던트를 찾을 수 없습니다." });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/incidents/:id", async (req, res) => {
  try {
    await deleteIncident(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 모델 성능 메트릭 ──────────────────────────────────────────────────────────
router.get("/model-metrics", async (req, res) => {
  try {
    const r = await axios.get(
      `${process.env.ML_SERVER_URL || "http://127.0.0.1:8000"}/metrics`,
      { timeout: 3000 }
    );
    res.json(r.data);
  } catch {
    res.status(503).json({ error: "ML 서버에서 메트릭을 가져올 수 없습니다." });
  }
});

module.exports = router;
