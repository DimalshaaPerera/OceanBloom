/*
 * store.js - DATA STORAGE
 * -----------------------
 * HIGH COHESION: the only file that reads and writes saved data. Users (and their
 * game statistics) are kept in a JSON file: data/users.json.
 * A real product would use a database; a JSON file keeps this project simple and
 * needs no extra software. Everything else asks this file for data, so changing
 * to a database later would only mean changing this file.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

const FILE = path.join(config.DATA_DIR, 'users.json');
let users = {};   // lower-case username -> user record

function load() {
  try {
    users = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    users = {};
  }
}

function save() {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  const temp = FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(users, null, 2));
  fs.renameSync(temp, FILE);   // write to a temp file first so a crash cannot corrupt the real one
}

function getUser(name) {
  return users[String(name || '').toLowerCase()] || null;
}

function findByEmail(email) {
  const wanted = String(email || '').toLowerCase();
  const keys = Object.keys(users);
  for (let i = 0; i < keys.length; i++) {
    if (users[keys[i]].email === wanted) { return users[keys[i]]; }
  }
  return null;
}

function createUser(data) {
  const user = {
    name: data.name,
    email: data.email,
    salt: data.salt,
    hash: data.hash,
    createdAt: new Date().toISOString(),
    stats: { bestScore: 0, highestLevel: 0, gamesCompleted: 0, totalMistakes: 0, recent: [] }
  };
  users[data.name.toLowerCase()] = user;
  save();
  return user;
}

function saveUser(user) {
  users[user.name.toLowerCase()] = user;
  save();
}

// Everyone who has played at least once, best first.
function rankedPlayers() {
  return Object.keys(users)
    .map(function (key) { return users[key]; })
    .filter(function (u) { return u.stats.highestLevel > 0; })
    .sort(function (a, b) {
      return (b.stats.bestScore - a.stats.bestScore) ||
             (b.stats.highestLevel - a.stats.highestLevel) ||
             a.name.localeCompare(b.name);
    });
}

// 1 = top of the leaderboard; null if the player has not played yet.
function rankOf(name) {
  const list = rankedPlayers();
  for (let i = 0; i < list.length; i++) {
    if (list[i].name.toLowerCase() === String(name).toLowerCase()) { return i + 1; }
  }
  return null;
}

load();

module.exports = { getUser, findByEmail, createUser, saveUser, rankedPlayers, rankOf };
