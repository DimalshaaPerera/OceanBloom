/*
 * verification.js - EMAIL VERIFICATION WITH A ONE-TIME CODE (OTP)
 * ---------------------------------------------------------------
 * Registration happens in two steps:
 *   1. The player sends username, email and password. We check them, then keep
 *      them as a PENDING registration (table "email_verifications", no account
 *      yet) and email a random 6-digit code.
 *   2. The player types the code. Only if it is right is the account created.
 * This proves the player really owns the email address.
 *
 * Security choices:
 *   - the code comes from crypto.randomInt (a secure random generator, not Math.random)
 *   - only an HMAC HASH of the code is stored, compared with timingSafeEqual
 *   - the code expires after 10 minutes and allows 5 wrong tries
 *   - a new code can be requested at most every 60 seconds (max 5 emails)
 *   - one IP address can start at most 10 registrations per 15 minutes
 *   - a code can be used only once (the row is deleted when it is used)
 * The pending password is already hashed (scrypt) - the plain password is never kept.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const crypto = require('crypto');
const db = require('./db');

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;
const MAX_SENDS = 5;
const IP_WINDOW_MINUTES = 15;
const MAX_STARTS_PER_IP = 10;

// Sign-up starts per IP address. Kept in memory: it only needs to live for 15 minutes.
const startsByIp = new Map();

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function newCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(code, salt) {
  return crypto.createHmac('sha256', salt).update(String(code)).digest('hex');
}

function newCodeFields() {
  const code = newCode();
  const salt = crypto.randomBytes(16).toString('hex');
  return { code: code, salt: salt, hash: hashCode(code, salt) };
}

const SELECT_PENDING =
  'SELECT id, username, email, password_salt, password_hash, code_salt, code_hash, attempts, sends, ' +
  '  TIMESTAMPDIFF(SECOND, last_sent_at, UTC_TIMESTAMP()) AS since_sent, ' +
  '  TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), expires_at) AS expires_in ' +
  'FROM email_verifications ';

function toRecord(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    salt: row.password_salt,
    hash: row.password_hash,
    codeSalt: row.code_salt,
    codeHash: row.code_hash,
    attempts: row.attempts,
    sends: row.sends,
    sinceSent: Number(row.since_sent),
    expiresIn: Number(row.expires_in)
  };
}

function secondsUntilResend(record) {
  return Math.max(0, RESEND_SECONDS - record.sinceSent);
}

function summary(record) {
  return { expiresInSeconds: Math.max(0, record.expiresIn), resendInSeconds: secondsUntilResend(record) };
}

function checkIpLimit(ip) {
  const now = Date.now();
  const recent = (startsByIp.get(ip) || []).filter(function (t) { return now - t < IP_WINDOW_MINUTES * 60 * 1000; });
  if (recent.length >= MAX_STARTS_PER_IP) {
    throw fail(429, 'Too many sign-up attempts. Please wait a few minutes and try again.');
  }
  recent.push(now);
  startsByIp.set(ip, recent);
}

// Step 1. data = { username, email, salt, hash }. Returns { id, code, record }.
async function start(data, ip) {
  // Too soon to send this email address another code?
  const previous = await db.query(SELECT_PENDING + 'WHERE email = ? AND expires_at > UTC_TIMESTAMP()', [data.email]);
  if (previous.length) {
    const wait = secondsUntilResend(toRecord(previous[0]));
    if (wait > 0) {
      throw fail(429, 'A code was just sent to this email. Please wait ' + wait + ' seconds before asking again.');
    }
  }
  checkIpLimit(ip);

  // Only one pending registration per email and per username: replace any older one.
  await db.query('DELETE FROM email_verifications WHERE email = ? OR username = ?', [data.email, data.username]);

  const id = crypto.randomBytes(24).toString('hex');
  const c = newCodeFields();
  await db.query(
    'INSERT INTO email_verifications (id, username, email, password_salt, password_hash, code_salt, code_hash, ' +
    '  attempts, sends, ip_address, last_sent_at, expires_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP() + INTERVAL ? MINUTE)',
    [id, data.username, data.email, data.salt, data.hash, c.salt, c.hash, ip || null, CODE_MINUTES]);
  return { id: id, code: c.code, record: await find(id) };
}

async function find(id) {
  const value = String(id || '');
  const rows = /^[0-9a-f]{48}$/.test(value)
    ? await db.query(SELECT_PENDING + 'WHERE id = ? AND expires_at > UTC_TIMESTAMP()', [value])
    : [];
  if (!rows.length) {
    throw fail(410, 'This code is no longer valid (it expired or was already used). Please fill in the form again.');
  }
  return toRecord(rows[0]);
}

// Ask for a fresh code (the old one stops working). Returns { code, record }.
async function resend(id) {
  const record = await find(id);
  const wait = secondsUntilResend(record);
  if (wait > 0) { throw fail(429, 'Please wait ' + wait + ' seconds before asking for a new code.'); }
  if (record.sends >= MAX_SENDS) {
    await cancel(record.id);
    throw fail(429, 'Too many codes sent. Please fill in the form again.');
  }
  const c = newCodeFields();
  await db.query(
    'UPDATE email_verifications SET code_salt = ?, code_hash = ?, attempts = 0, sends = sends + 1, ' +
    '  last_sent_at = UTC_TIMESTAMP(), expires_at = UTC_TIMESTAMP() + INTERVAL ? MINUTE WHERE id = ?',
    [c.salt, c.hash, CODE_MINUTES, record.id]);
  return { code: c.code, record: await find(record.id) };
}

// Step 2. Returns the pending registration if the code is right (and removes it).
async function verify(id, code) {
  const record = await find(id);
  const actual = Buffer.from(hashCode(String(code).trim(), record.codeSalt), 'hex');
  const expected = Buffer.from(record.codeHash, 'hex');
  const ok = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);

  if (!ok) {
    const left = MAX_ATTEMPTS - (record.attempts + 1);
    if (left <= 0) {
      await cancel(record.id);
      throw fail(429, 'Too many wrong codes. Please fill in the form again.');
    }
    await db.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?', [record.id]);
    throw fail(400, 'That code is not right. ' + left + (left === 1 ? ' try' : ' tries') + ' left.');
  }

  // Delete the row; if two requests arrive at once, only the one that deletes it wins.
  const result = await db.query('DELETE FROM email_verifications WHERE id = ?', [record.id]);
  if (result.affectedRows !== 1) {
    throw fail(410, 'This code is no longer valid (it expired or was already used). Please fill in the form again.');
  }
  return record;
}

async function cancel(id) {
  await db.query('DELETE FROM email_verifications WHERE id = ?', [String(id || '')]);
}

// Removes expired sign-ups. The server calls this every 10 minutes.
async function cleanUp() {
  await db.query('DELETE FROM email_verifications WHERE expires_at < UTC_TIMESTAMP()');
  const now = Date.now();
  startsByIp.forEach(function (times, ip) {
    if (times.every(function (t) { return now - t >= IP_WINDOW_MINUTES * 60 * 1000; })) { startsByIp.delete(ip); }
  });
}

module.exports = { CODE_MINUTES, start, resend, verify, cancel, summary, cleanUp };
