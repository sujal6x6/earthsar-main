const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const config = require("./config");

const pool = mysql.createPool({
  uri: config.databaseUrl,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "Z"
});

function normalizeValue(key, value) {
  if (value == null) return value;
  if ((key === "avatar" || key === "media") && typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return key === "media" ? [] : null;
    }
  }
  if (["verified", "published", "handled"].includes(key)) return Boolean(value);
  return value;
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(row => {
    const out = {};
    for (const [key, value] of Object.entries(row)) out[key] = normalizeValue(key, value);
    return out;
  });
}

function shape(result) {
  if (Array.isArray(result)) return { rows: normalizeRows(result), rowCount: result.length };
  return { rows: [], rowCount: result.affectedRows || 0, insertId: result.insertId || 0 };
}

async function query(sql, params = [], conn = pool) {
  const [result] = await conn.execute(sql, params);
  return shape(result);
}

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map(s => s.trim())
    .filter(Boolean);
  for (const statement of statements) await query(statement);
}

async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn({ query: (sql, params = []) => query(sql, params, conn) });
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, migrate, transaction };
