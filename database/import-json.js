/*
 * import-json.js - ONE-TIME MOVE from data/users.json into the MySQL database
 * --------------------------------------------------------------------------
 * Run with:  npm.cmd run db:import
 * Copies every account (with its password salt + hash, so the same password still
 * works), its statistics and its recent games. Accounts whose username or email is
 * already in the database are skipped, so it is safe to run more than once.
 * data/users.json itself is not changed.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const fs = require('fs');
const path = require('path');
const config = require('../server/config');
const db = require('../server/db');

const FILE = path.join(config.DATA_DIR, 'users.json');

function toSqlDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? new Date() : d;
}

async function main() {
  if (!fs.existsSync(FILE)) {
    console.log('Nothing to import: ' + FILE + ' does not exist.');
    return;
  }
  const users = Object.values(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  let imported = 0;
  let skipped = 0;

  for (const u of users) {
    const email = String(u.email || '').toLowerCase();
    const taken = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [u.name, email]);
    if (taken.length) {
      console.log('skip    ' + u.name + ' (already in the database)');
      skipped++;
      continue;
    }

    const s = u.stats || {};
    await db.transaction(async function (q) {
      const result = await q(
        'INSERT INTO users (username, email, password_salt, password_hash, email_verified, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?)',
        [u.name, email, u.salt, u.hash, u.emailVerified ? 1 : 0, toSqlDate(u.createdAt)]);
      const id = result.insertId;
      // The trigger made an empty player_stats row; fill it in.
      await q('UPDATE player_stats SET best_score = ?, highest_level = ?, games_completed = ?, total_mistakes = ? ' +
        'WHERE user_id = ?',
        [Math.min(s.bestScore || 0, 1000), Math.min(s.highestLevel || 0, 6), s.gamesCompleted || 0,
          s.totalMistakes || 0, id]);
      for (const game of (s.recent || []).slice().reverse()) {
        await q('INSERT INTO game_results (user_id, score, mistakes, finished_at) VALUES (?, ?, ?, ?)',
          [id, Math.min(game.score || 0, 1000), game.mistakes || 0, toSqlDate(game.at)]);
      }
    });
    console.log('import  ' + u.name);
    imported++;
  }
  console.log('\nDone: ' + imported + ' imported, ' + skipped + ' skipped.');
}

main().catch(function (error) {
  console.error('Import failed: ' + (error.code || '') + ' ' + error.message);
  process.exitCode = 1;
}).finally(function () {
  db.close();
});
