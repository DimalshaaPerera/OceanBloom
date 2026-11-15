/*
 * db.js - THE DATABASE CONNECTION
 * -------------------------------
 * HIGH COHESION: the only file that connects to MySQL / MariaDB. It keeps a
 * POOL of connections (opening a new connection for every request would be slow)
 * and gives the rest of the server two helpers:
 *   query(sql, values)    run one statement
 *   transaction(work)     run several statements that must ALL succeed or ALL be undone
 *
 * SECURITY: values are always passed separately from the SQL text ("?" placeholders,
 * a PREPARED STATEMENT). The database never treats player input as SQL code, which
 * stops SQL injection.
 *
 * Library: mysql2 (https://sidorares.github.io/node-mysql2/docs).
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  host: config.DB.host,
  port: config.DB.port,
  user: config.DB.user,
  password: config.DB.password,
  database: config.DB.database,
  connectionLimit: 10,
  dateStrings: false,
  timezone: 'Z',          // store and read every date in UTC
  charset: 'utf8mb4'
});

// Returns the rows for a SELECT, or the result info (insertId, affectedRows) otherwise.
async function query(sql, values) {
  const [rows] = await pool.execute(sql, values || []);
  return rows;
}

// work(q) receives its own query function that runs inside the transaction.
async function transaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(async function (sql, values) {
      const [rows] = await connection.execute(sql, values || []);
      return rows;
    });
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Called once at start-up so a wrong password / stopped MySQL is reported clearly.
async function check() {
  await pool.query("SET time_zone = '+00:00'");
  const rows = await query('SELECT COUNT(*) AS n FROM users');
  return rows[0].n;
}

function close() {
  return pool.end();
}

// Every new connection uses UTC, so NOW() matches the dates Node sends.
pool.on('connection', function (connection) {
  connection.query("SET time_zone = '+00:00'");
});

module.exports = { query, transaction, check, close };
