/*
 * security.js - VIRTUAL IDENTITY (server side)
 * --------------------------------------------
 *  1. PASSWORDS  - never stored. We store a random SALT and the SCRYPT hash of the
 *                  password. scrypt is deliberately slow, which makes guessing
 *                  passwords expensive for an attacker.
 *  2. SESSIONS   - after login the server creates a long random TOKEN and keeps it
 *                  in memory. The browser holds the token in a COOKIE.
 *  3. COOKIE     - HttpOnly (JavaScript on the page cannot read it, which limits
 *                  the damage of XSS) and SameSite=Strict (the browser will not send
 *                  it from other websites, which blocks most CSRF attacks).
 *                  A production site on HTTPS would also add the "Secure" flag.
 *  4. LOCK-OUT   - after 5 wrong passwords the login is blocked for 30 seconds.
 *
 * Compared with my first version (everything in the browser) this is much safer,
 * because users, hashes and sessions are on the server where visitors cannot see
 * or change them.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const crypto = require('crypto');

const COOKIE_NAME = 'oceanbloom_session';
const SESSION_SECONDS = 2 * 60 * 60;
const MAX_FAILED = 5;
const LOCK_SECONDS = 30;

const sessions = new Map();   // token -> { username, expires }
const failures = new Map();   // "ip|username" -> { count, lockedUntil }

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

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username: username, expires: Date.now() + SESSION_SECONDS * 1000 });
  return token;
}

function getSession(token) {
  if (!token) { return null; }
  const session = sessions.get(token);
  if (!session) { return null; }
  if (session.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.username;
}

function destroySession(token) {
  sessions.delete(token);
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

function lockSecondsLeft(key) {
  const f = failures.get(key);
  return f && f.lockedUntil > Date.now() ? Math.ceil((f.lockedUntil - Date.now()) / 1000) : 0;
}

function recordFailure(key) {
  const f = failures.get(key) || { count: 0, lockedUntil: 0 };
  f.count++;
  if (f.count >= MAX_FAILED) {
    f.count = 0;
    f.lockedUntil = Date.now() + LOCK_SECONDS * 1000;
  }
  failures.set(key, f);
}

function clearFailures(key) {
  failures.delete(key);
}

module.exports = {
  COOKIE_NAME, hashPassword, verifyPassword,
  createSession, getSession, destroySession, readCookie, sessionCookie, clearedCookie,
  lockSecondsLeft, recordFailure, clearFailures
};
