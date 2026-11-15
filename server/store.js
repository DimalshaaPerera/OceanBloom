/*
 * store.js - DATA STORAGE (MySQL / MariaDB)
 * -----------------------------------------
 * HIGH COHESION: the only file that reads and writes players and their game
 * statistics. It uses the tables made by database/oceanbloom.sql:
 *   users          the accounts (salt + scrypt hash, never the password)
 *   player_stats   best score, highest level, ... (one row per user, made by a trigger)
 *   game_results   one row per finished game
 *   leaderboard    a VIEW that ranks the players
 *   email_log      every email the server tried to send
 * Everything else asks this file for data, so the rest of the server does not
 * know (or care) which database is used.
 *
 * Every function is async because the database answers over the network.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const db = require('./db');

const RECENT_GAMES = 10;

const USER_COLUMNS =
  'u.id, u.username, u.email, u.password_salt, u.password_hash, u.email_verified, u.created_at, ' +
  's.best_score, s.highest_level, s.games_completed, s.total_mistakes';

// One database row -> the user object the rest of the server works with.
function toUser(row) {
  if (!row) { return null; }
  return {
    id: row.id,
    name: row.username,
    email: row.email,
    salt: row.password_salt,
    hash: row.password_hash,
    emailVerified: row.email_verified === 1,
    createdAt: new Date(row.created_at).toISOString(),
    stats: {
      bestScore: row.best_score || 0,
      highestLevel: row.highest_level || 0,
      gamesCompleted: row.games_completed || 0,
      totalMistakes: row.total_mistakes || 0
    }
  };
}

async function findOne(where, value) {
  const rows = await db.query(
    'SELECT ' + USER_COLUMNS + ' FROM users u LEFT JOIN player_stats s ON s.user_id = u.id WHERE ' + where + ' LIMIT 1',
    [value]);
  return toUser(rows[0]);
}

// Usernames are compared without caring about upper/lower case (the table's collation does that).
function getUser(name) {
  return findOne('u.username = ?', String(name || ''));
}

function getUserById(id) {
  return findOne('u.id = ?', Number(id));
}

function findByEmail(email) {
  return findOne('u.email = ?', String(email || '').toLowerCase());
}

// The newest finished games, for the dashboard.
async function recentGames(userId) {
  const rows = await db.query(
    'SELECT score, mistakes, finished_at FROM game_results WHERE user_id = ? ' +
    'ORDER BY finished_at DESC, id DESC LIMIT ' + RECENT_GAMES, [userId]);
  return rows.map(function (r) {
    return { score: r.score, mistakes: r.mistakes, at: new Date(r.finished_at).toISOString() };
  });
}

// data = { name, email, salt, hash, emailVerified }. The trigger adds the empty player_stats row.
async function createUser(data) {
  const verified = data.emailVerified === true;
  const result = await db.query(
    'INSERT INTO users (username, email, password_salt, password_hash, email_verified, email_verified_at) ' +
    'VALUES (?, ?, ?, ?, ?, ' + (verified ? 'UTC_TIMESTAMP()' : 'NULL') + ')',
    [data.name, String(data.email).toLowerCase(), data.salt, data.hash, verified ? 1 : 0]);
  return getUserById(result.insertId);
}

// Saves a level reached or a finished game. Both changes happen together or not at all.
// Returns the new statistics.
async function recordProgress(userId, level, score, mistakes, finished) {
  await db.transaction(async function (q) {
    await q(
      'UPDATE player_stats SET best_score = GREATEST(best_score, ?), highest_level = GREATEST(highest_level, ?)' +
      (finished ? ', games_completed = games_completed + 1, total_mistakes = total_mistakes + ?' : '') +
      ' WHERE user_id = ?',
      finished ? [score, level, mistakes, userId] : [score, level, userId]);
    if (finished) {
      await q('INSERT INTO game_results (user_id, score, mistakes) VALUES (?, ?, ?)', [userId, score, mistakes]);
    }
  });
  const user = await getUserById(userId);
  return user.stats;
}

// Top players, best first (the leaderboard VIEW does the ranking).
function topPlayers(limit) {
  return db.query(
    'SELECT player_rank, username, best_score, highest_level, games_completed FROM leaderboard ' +
    'ORDER BY player_rank LIMIT ' + Number(limit));
}

// How many players have played at least once.
async function countRanked() {
  const rows = await db.query('SELECT COUNT(*) AS n FROM leaderboard');
  return Number(rows[0].n);
}

// 1 = top of the leaderboard; null if the player has not played yet.
async function rankOf(userId) {
  const rows = await db.query('SELECT player_rank FROM leaderboard WHERE user_id = ?', [userId]);
  return rows.length ? Number(rows[0].player_rank) : null;
}

// Never throws: a logging problem must not stop an email or a sign-up.
async function logEmail(entry) {
  try {
    await db.query(
      'INSERT INTO email_log (user_id, recipient, email_type, provider, sent_ok, error_text) VALUES (?, ?, ?, ?, ?, ?)',
      [entry.userId || null, entry.recipient, entry.type, entry.provider, entry.sentOk ? 1 : 0,
        entry.error ? String(entry.error).slice(0, 300) : null]);
  } catch (error) {
    console.error('Could not write to email_log: ' + error.message);
  }
}

module.exports = {
  getUser, getUserById, findByEmail, recentGames, createUser, recordProgress,
  topPlayers, countRanked, rankOf, logEmail
};
