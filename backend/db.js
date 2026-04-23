const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS traffic_events (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      label VARCHAR(50) NOT NULL,
      confidence FLOAT NOT NULL,
      flow_duration FLOAT,
      total_fwd_packets FLOAT,
      total_bwd_packets FLOAT,
      flow_bytes_per_sec FLOAT,
      flow_packets_per_sec FLOAT,
      fwd_packet_len_mean FLOAT,
      bwd_packet_len_mean FLOAT,
      syn_flag_count FLOAT,
      ack_flag_count FLOAT,
      psh_flag_count FLOAT,
      rst_flag_count FLOAT,
      fin_flag_count FLOAT,
      avg_packet_size FLOAT,
      probabilities JSONB
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS incidents (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES traffic_events(id) ON DELETE SET NULL,
      label VARCHAR(50) NOT NULL,
      severity VARCHAR(10) NOT NULL DEFAULT 'medium',
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      title VARCHAR(200),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `);

  console.log("DB 초기화 완료");
}

// ── 인시던트 CRUD ─────────────────────────────────────────────────────────────

async function getIncidents({ status, label } = {}) {
  const conditions = [];
  const params     = [];
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  if (label)  { params.push(label);  conditions.push(`label  = $${params.length}`); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const result = await pool.query(
    `SELECT * FROM incidents ${where} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  return result.rows;
}

async function createIncident({ event_id, label, severity = "medium", title, notes } = {}) {
  const result = await pool.query(
    `INSERT INTO incidents (event_id, label, severity, title, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [event_id || null, label, severity, title || null, notes || null]
  );
  return result.rows[0];
}

async function updateIncident(id, { status, severity, title, notes } = {}) {
  const sets   = [];
  const params = [];
  if (status   !== undefined) { params.push(status);   sets.push(`status = $${params.length}`); }
  if (severity !== undefined) { params.push(severity); sets.push(`severity = $${params.length}`); }
  if (title    !== undefined) { params.push(title);    sets.push(`title = $${params.length}`); }
  if (notes    !== undefined) { params.push(notes);    sets.push(`notes = $${params.length}`); }
  if (sets.length === 0) return null;

  sets.push(`updated_at = NOW()`);
  if (status === "resolved") sets.push(`resolved_at = NOW()`);

  params.push(id);
  const result = await pool.query(
    `UPDATE incidents SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

async function deleteIncident(id) {
  await pool.query("DELETE FROM incidents WHERE id = $1", [id]);
}

async function insertEvent(event) {
  const {
    label, confidence, probabilities,
    flow_duration, total_fwd_packets, total_bwd_packets,
    flow_bytes_per_sec, flow_packets_per_sec,
    fwd_packet_len_mean, bwd_packet_len_mean,
    syn_flag_count, ack_flag_count, psh_flag_count,
    rst_flag_count, fin_flag_count, avg_packet_size,
  } = event;

  const result = await pool.query(
    `INSERT INTO traffic_events (
      label, confidence, probabilities,
      flow_duration, total_fwd_packets, total_bwd_packets,
      flow_bytes_per_sec, flow_packets_per_sec,
      fwd_packet_len_mean, bwd_packet_len_mean,
      syn_flag_count, ack_flag_count, psh_flag_count,
      rst_flag_count, fin_flag_count, avg_packet_size
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    RETURNING *`,
    [
      label, confidence, JSON.stringify(probabilities),
      flow_duration, total_fwd_packets, total_bwd_packets,
      flow_bytes_per_sec, flow_packets_per_sec,
      fwd_packet_len_mean, bwd_packet_len_mean,
      syn_flag_count, ack_flag_count, psh_flag_count,
      rst_flag_count, fin_flag_count, avg_packet_size,
    ]
  );
  return result.rows[0];
}

async function getEvents({ limit = 50, offset = 0, label, from, to, minConfidence } = {}) {
  const conditions = [];
  const params = [];

  if (label) {
    params.push(label);
    conditions.push(`label = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`timestamp >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`timestamp <= $${params.length}`);
  }
  if (minConfidence !== undefined) {
    params.push(minConfidence);
    conditions.push(`confidence >= $${params.length}`);
  }

  let query = "SELECT * FROM traffic_events";
  if (conditions.length) query += " WHERE " + conditions.join(" AND ");
  query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}

async function exportEvents({ label, from, to, minConfidence } = {}) {
  const conditions = [];
  const params = [];

  if (label) { params.push(label); conditions.push(`label = $${params.length}`); }
  if (from)  { params.push(from);  conditions.push(`timestamp >= $${params.length}`); }
  if (to)    { params.push(to);    conditions.push(`timestamp <= $${params.length}`); }
  if (minConfidence !== undefined) {
    params.push(minConfidence);
    conditions.push(`confidence >= $${params.length}`);
  }

  let query = "SELECT * FROM traffic_events";
  if (conditions.length) query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY timestamp DESC";

  const result = await pool.query(query, params);
  return result.rows;
}

async function getStats({ from, to } = {}) {
  const conditions = [];
  const params = [];
  if (from) { params.push(from); conditions.push(`timestamp >= $${params.length}`); }
  if (to)   { params.push(to);   conditions.push(`timestamp <= $${params.length}`); }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const result = await pool.query(
    `SELECT label, COUNT(*) AS count FROM traffic_events ${where} GROUP BY label ORDER BY count DESC`,
    params
  );
  return result.rows;
}

module.exports = {
  initDB, insertEvent, getEvents, exportEvents, getStats,
  getIncidents, createIncident, updateIncident, deleteIncident,
};
