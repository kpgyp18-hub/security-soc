const { Pool } = require("pg");

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function cleanOldEvents() {
  const days = parseInt(process.env.DATA_RETENTION_DAYS || "7", 10);
  try {
    const result = await pool.query(
      `DELETE FROM traffic_events WHERE timestamp < NOW() - INTERVAL '${days} days'`
    );
    if (result.rowCount > 0) {
      console.log(`[maintenance] 오래된 이벤트 ${result.rowCount}건 삭제 (보존 기간: ${days}일)`);
    }
  } catch (err) {
    console.error("[maintenance] 삭제 오류:", err.message);
  }
}

function startMaintenance() {
  cleanOldEvents();
  setInterval(cleanOldEvents, 60 * 60 * 1000); // 매 1시간마다
}

module.exports = { startMaintenance };
