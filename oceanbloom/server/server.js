/*
 * server.js - THE WEB SERVER
 * --------------------------
 * Does three things:
 *   1. Serves the web pages in the "public" folder (the pages that need a login
 *      are only given to logged-in players).
 *   2. Provides a small REST API that the pages call with fetch():
 *        POST /api/register   create account + send welcome email
 *        POST /api/login      log in
 *        POST /api/logout     log out
 *        GET  /api/me         who am I, and my statistics
 *        POST /api/progress   save my level / score
 *        GET  /api/leaderboard  top players
 *        GET  /api/fish       ask the third-party Fish Game service for a picture
 *   3. Acts as a go-between: the browser never contacts the Fish Game service
 *      directly, our server does. (This avoids browser cross-origin problems and
 *      lets us check the data we get back before passing it on.)
 *
 * It uses only Node's built-in modules (http, fs, path, crypto) - no add-on libraries.
 * Welcome emails are sent through the Brevo web API, called by mailer.js.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const store = require('./store');
const security = require('./security');
const mailer = require('./mailer');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const TOTAL_LEVELS = 6;
const MAX_SCORE = 1000;   // the real maximum is 968 (see game.js), so anything higher is not genuine
const GUARDED_PAGES = new Set(['/game.html', '/dashboard.html', '/leaderboard.html']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Used so that a login for an unknown username takes as long as one for a known
// username (otherwise the response time would reveal which usernames exist).
const DUMMY = security.hashPassword('not-a-real-password');

/* ---------- small helpers ---------- */

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(data);
}

function readJson(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > 10240) {
        reject(httpError(413, 'Request is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () {
      if (chunks.length === 0) { resolve({}); return; }
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(value && typeof value === 'object' ? value : {});
      } catch (e) {
        reject(httpError(400, 'Invalid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function currentUser(req) {
  const token = security.readCookie(req, security.COOKIE_NAME);
  const name = security.getSession(token);
  return name ? store.getUser(name) : null;
}

function publicProfile(user) {
  return {
    username: user.name,
    email: user.email,
    createdAt: user.createdAt,
    stats: user.stats,
    rank: store.rankOf(user.name),
    totalPlayers: store.rankedPlayers().length
  };
}

function startSession(res, user) {
  res.setHeader('Set-Cookie', security.sessionCookie(security.createSession(user.name)));
}

/* ---------- API handlers ---------- */

async function register(ctx) {
  const username = String(ctx.body.username || '').trim();
  const email = String(ctx.body.email || '').trim().toLowerCase();
  const password = String(ctx.body.password || '');

  if (!/^[A-Za-z0-9_]{3,15}$/.test(username)) {
    throw httpError(400, 'Username must be 3-15 letters, numbers or underscores.');
  }
  if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, 'Please enter a valid email address.');
  }
  if (password.length < 6 || password.length > 100) {
    throw httpError(400, 'Password must be 6-100 characters.');
  }
  if (store.getUser(username)) { throw httpError(409, 'That username is already taken.'); }
  if (store.findByEmail(email)) { throw httpError(409, 'That email is already registered.'); }

  const secret = security.hashPassword(password);
  const user = store.createUser({ name: username, email: email, salt: secret.salt, hash: secret.hash });
  startSession(ctx.res, user);

  // The account exists even if the email fails; we just tell the player what happened.
  const mail = await mailer.sendWelcomeEmail(user);
  sendJson(ctx.res, 201, { username: user.name, emailSent: mail.sent, emailNote: mail.reason || null });
}

async function login(ctx) {
  const username = String(ctx.body.username || '').trim();
  const password = String(ctx.body.password || '');
  const key = (ctx.req.socket.remoteAddress || '') + '|' + username.toLowerCase();

  const wait = security.lockSecondsLeft(key);
  if (wait > 0) { throw httpError(429, 'Too many attempts. Try again in ' + wait + ' seconds.'); }

  const user = store.getUser(username);
  let ok = false;
  if (user) {
    ok = security.verifyPassword(password, user.salt, user.hash);
  } else {
    security.verifyPassword(password, DUMMY.salt, DUMMY.hash);   // wasted on purpose, same delay
  }

  if (!ok) {
    security.recordFailure(key);
    // Same message whether the username or the password was wrong.
    throw httpError(401, 'Wrong username or password.');
  }
  security.clearFailures(key);
  startSession(ctx.res, user);
  sendJson(ctx.res, 200, { username: user.name });
}

async function logout(ctx) {
  security.destroySession(security.readCookie(ctx.req, security.COOKIE_NAME));
  ctx.res.setHeader('Set-Cookie', security.clearedCookie());
  sendJson(ctx.res, 200, { ok: true });
}

async function me(ctx) {
  sendJson(ctx.res, 200, publicProfile(ctx.user));
}

// The game reports a level reached or a finished run.
async function progress(ctx) {
  const level = Number(ctx.body.level);
  const score = Number(ctx.body.score);
  const mistakes = Number(ctx.body.mistakes);
  const finished = ctx.body.finished === true;

  const valid = Number.isInteger(level) && level >= 1 && level <= TOTAL_LEVELS &&
                Number.isInteger(score) && score >= 0 && score <= MAX_SCORE &&
                Number.isInteger(mistakes) && mistakes >= 0 && mistakes <= 10000 &&
                (!finished || level === TOTAL_LEVELS);
  if (!valid) { throw httpError(400, 'Invalid progress data.'); }

  const stats = ctx.user.stats;
  stats.highestLevel = Math.max(stats.highestLevel, level);
  stats.bestScore = Math.max(stats.bestScore, score);
  if (finished) {
    stats.gamesCompleted++;
    stats.totalMistakes += mistakes;
    stats.recent.unshift({ score: score, mistakes: mistakes, at: new Date().toISOString() });
    stats.recent = stats.recent.slice(0, 10);
  }
  store.saveUser(ctx.user);

  sendJson(ctx.res, 200, {
    bestScore: stats.bestScore,
    highestLevel: stats.highestLevel,
    rank: store.rankOf(ctx.user.name)
  });
}

async function leaderboard(ctx) {
  const all = store.rankedPlayers();
  const top = all.slice(0, 10).map(function (u, i) {
    return {
      rank: i + 1,
      username: u.name,
      bestScore: u.stats.bestScore,
      highestLevel: u.stats.highestLevel,
      gamesCompleted: u.stats.gamesCompleted
    };
  });
  sendJson(ctx.res, 200, { players: top, total: all.length });
}

// INTEROPERABILITY: our server calls the Fish Game web service (HTTP GET, JSON).
async function fish(ctx) {
  try {
    const response = await fetch(config.FISH_API_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) { throw new Error('Fish Game service answered HTTP ' + response.status); }
    const data = await response.json();

    // Never trust data from another system blindly: check its shape.
    if (typeof data.question !== 'string' || !/^https?:\/\//.test(data.question) ||
        !Number.isInteger(data.fish) || data.fish < 0) {
      throw new Error('Unexpected response from the Fish Game service');
    }
    sendJson(ctx.res, 200, { imageUrl: data.question, answer: data.fish });
  } catch (error) {
    console.error('Fish Game service problem: ' + error.message);
    throw httpError(502, 'The Fish Game service is not available right now.');
  }
}

// method + path -> { handler, needs a logged-in user?, reads a JSON body? }
const API = {
  'POST /api/register':   { handler: register,    auth: false, body: true },
  'POST /api/login':      { handler: login,       auth: false, body: true },
  'POST /api/logout':     { handler: logout,      auth: false, body: false },
  'GET /api/me':          { handler: me,          auth: true,  body: false },
  'POST /api/progress':   { handler: progress,    auth: true,  body: true },
  'GET /api/leaderboard': { handler: leaderboard, auth: true,  body: false },
  'GET /api/fish':        { handler: fish,        auth: true,  body: false }
};

async function handleApi(req, res, pathname) {
  const entry = API[req.method + ' ' + pathname];
  if (!entry) { throw httpError(404, 'Unknown API address.'); }

  const user = currentUser(req);
  if (entry.auth && !user) { throw httpError(401, 'Please log in.'); }

  const body = entry.body ? await readJson(req) : {};
  await entry.handler({ req: req, res: res, user: user, body: body });
}

/* ---------- web pages ---------- */

async function servePage(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }
  if (pathname === '/') {
    res.writeHead(302, { Location: currentUser(req) ? '/dashboard.html' : '/login.html' });
    res.end();
    return;
  }
  // Pages for players only: anyone else is sent to the login page.
  if (GUARDED_PAGES.has(pathname) && !currentUser(req)) {
    res.writeHead(302, { Location: '/login.html' });
    res.end();
    return;
  }

  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch (e) {
    res.writeHead(400);
    res.end();
    return;
  }
  const file = path.join(PUBLIC_DIR, relative);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {   // block "../" tricks
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const data = await fs.promises.readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache'
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Page not found');
  }
}

/* ---------- start ---------- */

const server = http.createServer(async function (req, res) {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
    } else {
      await servePage(req, res, pathname);
    }
  } catch (error) {
    if (!error.status) { console.error(error); }
    if (!res.headersSent) {
      sendJson(res, error.status || 500, { error: error.status ? error.message : 'Server error.' });
    }
  }
});

server.listen(config.PORT, function () {
  console.log('OceanBloom is running at http://localhost:' + config.PORT);
  console.log(mailer.isConfigured()
    ? 'Email: ready (sending through the Brevo API)'
    : 'Email: NOT configured - welcome emails will be printed here instead (see README).');
});
