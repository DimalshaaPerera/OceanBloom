/*
 * security.js - VIRTUAL IDENTITY (server side)
 * --------------------------------------------
 *  1. PASSWORDS  - never stored. We store a random SALT and the SCRYPT hash of the
 *                  password. scrypt is deliberately slow, which makes guessing
 *                  passwords expensive for an attacker.
 *  2. SESSIONS   - after login the server creates a long random TOKEN. The browser
 *                  holds the token in a COOKIE; the database "sessions" table keeps
 *                  only a SHA-256 HASH of it, so a stolen copy of the table cannot
 *                  be used to log in. Sessions survive a server restart.
 *  3. COOKIE     - HttpOnly (JavaScript on the page cannot read it, which limits
 *                  the damage of XSS) and SameSite=Strict (the browser will not send
 *                  it from other websites, which blocks most CSRF attacks).
 *                  A production site on HTTPS would also add the "Secure" flag.
 *  4. LOCK-OUT   - after 5 wrong passwords (same IP + username) the login is
 *                  blocked for 30 seconds ("login_attempts" table).
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const crypto = require('crypto');
const db = require('./db');

const COOKIE_NAME = 'oceanbloom_session';
const SESSION_SECONDS = 2 * 60 * 60;
const MAX_FAILED = 5;
const LOCK_SECONDS = 30;

/* ---------- passwords ---------- */

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, useSalt, 64).toString('hex');
  return { salt: useSalt, hash: hash };
}

function verifyPassword(password, salt, expectedHash) {
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/* ---------- sessions and cookies ---------- */

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Returns the token for the cookie. Only its hash goes into the database.
async function createSession(userId, ip, userAgent) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.query(
    'INSERT INTO sessions (token_hash, user_id, ip_address, user_agent, expires_at) ' +
    'VALUES (?, ?, ?, ?, UTC_TIMESTAMP() + INTERVAL ? SECOND)',
    [hashToken(token), userId, ip || null, userAgent ? String(userAgent).slice(0, 255) : null, SESSION_SECONDS]);
  return token;
}

// Returns the user id for a valid, unexpired token, otherwise null.
async function getSession(token) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) { return null; }
  const rows = await db.query(
    'SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP()', [hashToken(token)]);
  return rows.length ? rows[0].user_id : null;
}

async function destroySession(token) {
  if (token) { await db.query('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]); }
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  const parts = header.split(';');
  for (let i = 0; i < parts.length; i++) {
    const piece = parts[i].trim();
    const eq = piece.indexOf('=');
    if (eq > 0 && piece.slice(0, eq) === name) {
      try {
        return decodeURIComponent(piece.slice(eq + 1));
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

function sessionCookie(token) {
  return COOKIE_NAME + '=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + SESSION_SECONDS;
}

function clearedCookie() {
  return COOKIE_NAME + '=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';
}

/* ---------- brute-force protection ---------- */

async function lockSecondsLeft(ip, username) {
  const rows = await db.query(
    'SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), locked_until) AS wait FROM login_attempts ' +
    'WHERE ip_address = ? AND username = ? AND locked_until > UTC_TIMESTAMP()',
    [ip, String(username).toLowerCase()]);
  return rows.length ? Math.max(1, Number(rows[0].wait)) : 0;
}

// Count one wrong password; the 5th one in a row locks the login for 30 seconds.
async function recordFailure(ip, username) {
  await db.query(
    'INSERT INTO login_attempts (ip_address, username, failed_count, locked_until) VALUES (?, ?, 1, NULL) ' +
    'ON DUPLICATE KEY UPDATE ' +
    '  locked_until = IF(failed_count + 1 >= ?, UTC_TIMESTAMP() + INTERVAL ? SECOND, locked_until), ' +
    '  failed_count = IF(failed_count + 1 >= ?, 0, failed_count + 1)',
    [ip, String(username).toLowerCase(), MAX_FAILED, LOCK_SECONDS, MAX_FAILED]);
}

async function clearFailures(ip, username) {
  await db.query('DELETE FROM login_attempts WHERE ip_address = ? AND username = ?', [ip, String(username).toLowerCase()]);
}

/* ---------- tidying up ---------- */

// Removes expired sessions and old lock-outs. The server calls this every 10 minutes.
async function cleanUp() {
  await db.query('DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()');
  await db.query('DELETE FROM login_attempts WHERE last_attempt < UTC_TIMESTAMP() - INTERVAL 1 DAY');
}

module.exports = {
  COOKIE_NAME, hashPassword, verifyPassword,
  createSession, getSession, destroySession, readCookie, sessionCookie, clearedCookie,
  lockSecondsLeft, recordFailure, clearFailures, cleanUp
};
