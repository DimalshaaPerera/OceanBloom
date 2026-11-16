/*
 * server.js - THE WEB SERVER
 * --------------------------
 * Does three things:
 *   1. Serves the web pages in the "public" folder (the pages that need a login
 *      are only given to logged-in players).
 *   2. Provides a small REST API that the pages call with fetch():
 *        POST /api/register/start   check details, email a 6-digit code (OTP)
 *        POST /api/register/resend  email a new code
 *        POST /api/register/verify  check the code, create the account,
 *                                   send the welcome email (the player then logs in)
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
 * It uses Node's built-in modules (http, fs, path, crypto) plus one library, mysql2,
 * used only by db.js to talk to the MySQL / MariaDB database.
 * Welcome emails are sent by mailer.js (Mailpit locally, or the Brevo web API).
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
const db = require('./db');
const verification = require('./verification');
const Validation = require('../public/js/validation');   // the same rules the login page uses

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

async function currentUser(req) {
  const token = security.readCookie(req, security.COOKIE_NAME);
  const userId = await security.getSession(token);
  return userId ? store.getUserById(userId) : null;
}

async function publicProfile(user) {
  const results = await Promise.all([store.recentGames(user.id), store.rankOf(user.id), store.countRanked()]);
  return {
    username: user.name,
    email: user.email,
    createdAt: user.createdAt,
    stats: Object.assign({}, user.stats, { recent: results[0] }),
    rank: results[1],
    totalPlayers: results[2]
  };
}

async function startSession(req, res, user) {
  const token = await security.createSession(user.id, clientIp(req), req.headers['user-agent']);
  res.setHeader('Set-Cookie', security.sessionCookie(token));
}

function clientIp(req) {
  return req.socket.remoteAddress || '';
}

/* ---------- API handlers ---------- */

// Note about the verification email for the page when it did not go to a real inbox.
// With Mailpit the code is in the local test inbox, NOT in the player's real email -
// without this note players wait for an email that never arrives and the account is never created.
function codeNote(mail) {
  if (!mail.sent) { return 'Email is not set up on the server, so the code was printed in the server terminal.'; }
  if (config.EMAIL.provider === 'mailpit') {
    return 'Test mode: the code was sent to the local Mailpit inbox, not your real email. ' +
           'Open ' + config.EMAIL.mailpitUrl + ' to read it, then type it below.';
  }
  return null;
}

// REGISTER STEP 1: check the details, then email a 6-digit code. No account is created yet.
async function registerStart(ctx) {
  const username = String(ctx.body.username || '').trim();
  const email = String(ctx.body.email || '').trim().toLowerCase();
  const password = String(ctx.body.password || '');
  const confirm = String(ctx.body.confirmPassword || '');

  // The same rules the page uses (public/js/validation.js), checked again here.
  const problem = Validation.checkUsername(username) || Validation.checkEmail(email) ||
                  Validation.checkPassword(password, username) || Validation.checkConfirm(password, confirm);
  if (problem) { throw httpError(400, problem); }
  if (await store.getUser(username)) { throw httpError(409, 'That username is already taken.'); }
  if (await store.findByEmail(email)) { throw httpError(409, 'That email is already registered. Try logging in.'); }

  const secret = security.hashPassword(password);
  const started = await verification.start(
    { username: username, email: email, salt: secret.salt, hash: secret.hash }, clientIp(ctx.req));

  const mail = await mailer.sendVerificationCode({ name: username, email: email }, started.code,
    verification.CODE_MINUTES);
  if (!mail.sent && mailer.isConfigured()) {
    await verification.cancel(started.id);
    throw httpError(502, 'We could not send the verification email. Please try again in a moment.');
  }

  const info = verification.summary(started.record);
  sendJson(ctx.res, 202, {
    pendingId: started.id,
    email: email,
    expiresInSeconds: info.expiresInSeconds,
    resendInSeconds: info.resendInSeconds,
    note: codeNote(mail)
  });
}

// REGISTER: send a new code for a pending registration.
async function registerResend(ctx) {
  const again = await verification.resend(ctx.body.pendingId);
  const mail = await mailer.sendVerificationCode({ name: again.record.username, email: again.record.email },
    again.code, verification.CODE_MINUTES);
  if (!mail.sent && mailer.isConfigured()) {
    throw httpError(502, 'We could not send the verification email. Please try again in a moment.');
  }
  const info = verification.summary(again.record);
  sendJson(ctx.res, 200, {
    expiresInSeconds: info.expiresInSeconds,
    resendInSeconds: info.resendInSeconds,
    note: codeNote(mail)
  });
}

// REGISTER STEP 2: check the code, create the account and log the player in straight away.
async function registerVerify(ctx) {
  const code = String(ctx.body.code || '').trim();
  const problem = Validation.checkOtp(code);
  if (problem) { throw httpError(400, problem); }

  const pending = await verification.verify(ctx.body.pendingId, code);

  // Someone else may have taken the name or email while this player was reading their inbox.
  // (The UNIQUE keys in the users table are the final guard against two sign-ups at once.)
  let user;
  try {
    user = await store.createUser({
      name: pending.username, email: pending.email, salt: pending.salt, hash: pending.hash, emailVerified: true
    });
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') { throw error; }
    throw httpError(409, /email/.test(error.message)
      ? 'That email is already registered. Try logging in.'
      : 'Sorry, that username was just taken. Please choose another.');
  }
  // No automatic login: the page shows a success message and the player then logs in.

  // Answer straight away so the player moves on at once; the welcome email is sent in the
  // background (sendWelcomeEmail never throws, and logs any problem in the terminal).
  mailer.sendWelcomeEmail(user);
  sendJson(ctx.res, 201, { username: user.name, emailSent: mailer.isConfigured(), emailNote: null });
}

async function login(ctx) {
  const username = String(ctx.body.username || '').trim();
  const password = String(ctx.body.password || '');

  const problems = Validation.checkLogin(username, password);
  if (problems.username || problems.password) {
    // A badly formed username cannot exist, so this reveals nothing about real accounts.
    throw httpError(400, problems.username || problems.password);
  }
  const ip = clientIp(ctx.req);

  const wait = await security.lockSecondsLeft(ip, username);
  if (wait > 0) { throw httpError(429, 'Too many attempts. Try again in ' + wait + ' seconds.'); }

  const user = await store.getUser(username);
  let ok = false;
  if (user) {
    ok = security.verifyPassword(password, user.salt, user.hash);
  } else {
    security.verifyPassword(password, DUMMY.salt, DUMMY.hash);   // wasted on purpose, same delay
  }

  if (!ok) {
    await security.recordFailure(ip, username);
    // Same message whether the username or the password was wrong.
    throw httpError(401, 'Wrong username or password.');
  }
  await security.clearFailures(ip, username);
  await startSession(ctx.req, ctx.res, user);
  sendJson(ctx.res, 200, { username: user.name });
}

async function logout(ctx) {
  await security.destroySession(security.readCookie(ctx.req, security.COOKIE_NAME));
  ctx.res.setHeader('Set-Cookie', security.clearedCookie());
  sendJson(ctx.res, 200, { ok: true });
}

async function me(ctx) {
  sendJson(ctx.res, 200, await publicProfile(ctx.user));
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

  const stats = await store.recordProgress(ctx.user.id, level, score, mistakes, finished);

  sendJson(ctx.res, 200, {
    bestScore: stats.bestScore,
    highestLevel: stats.highestLevel,
    rank: await store.rankOf(ctx.user.id)
  });
}

async function leaderboard(ctx) {
  const rows = await store.topPlayers(10);
  const top = rows.map(function (r) {
    return {
      rank: Number(r.player_rank),
      username: r.username,
      bestScore: r.best_score,
      highestLevel: r.highest_level,
      gamesCompleted: r.games_completed
    };
  });
  sendJson(ctx.res, 200, { players: top, total: await store.countRanked() });
}

// INTEROPERABILITY: our server calls the Fish Game web service (HTTP GET, JSON).
// The service runs on someone else's server, so it is sometimes slow. One slow
// answer should not stop the game: we try up to FISH_ATTEMPTS times, each with
// its own time limit, and only report an error if every attempt fails.
const FISH_ATTEMPTS = 3;
const FISH_TIMEOUT_MS = 6000;

async function askFishService() {
  const response = await fetch(config.FISH_API_URL, {
    signal: AbortSignal.timeout(FISH_TIMEOUT_MS),
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) { throw new Error('Fish Game service answered HTTP ' + response.status); }
  const data = await response.json();

  // Never trust data from another system blindly: check its shape.
  if (typeof data.question !== 'string' || !/^https?:\/\//.test(data.question) ||
      !Number.isInteger(data.fish) || data.fish < 0) {
    throw new Error('Unexpected response from the Fish Game service');
  }
  return data;
}

async function fish(ctx) {
  for (let attempt = 1; attempt <= FISH_ATTEMPTS; attempt++) {
    try {
      const data = await askFishService();
      sendJson(ctx.res, 200, { imageUrl: data.question, answer: data.fish });
      return;
    } catch (error) {
      console.error('Fish Game service problem (attempt ' + attempt + ' of ' + FISH_ATTEMPTS + '): ' + error.message);
      if (attempt < FISH_ATTEMPTS) { await new Promise(function (r) { setTimeout(r, 500 * attempt); }); }
    }
  }
  throw httpError(502, 'The Fish Game service is not available right now.');
}

// method + path -> { handler, needs a logged-in user?, reads a JSON body? }
const API = {
  'POST /api/register/start':  { handler: registerStart,  auth: false, body: true },
  'POST /api/register/resend': { handler: registerResend, auth: false, body: true },
  'POST /api/register/verify': { handler: registerVerify, auth: false, body: true },
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

  const user = entry.auth ? await currentUser(req) : null;
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
    res.writeHead(302, { Location: (await currentUser(req)) ? '/dashboard.html' : '/login.html' });
    res.end();
    return;
  }
  // Pages for players only: anyone else is sent to the login page.
  if (GUARDED_PAGES.has(pathname) && !(await currentUser(req))) {
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

// Check the database first, so a stopped MySQL or a wrong password gives a clear message.
db.check().then(function (userCount) {
  server.listen(config.PORT, function () {
    console.log('OceanBloom is running at http://localhost:' + config.PORT);
    console.log('Database: connected to "' + config.DB.database + '" on ' + config.DB.host + ':' + config.DB.port +
      ' (' + userCount + ' player' + (userCount === 1 ? '' : 's') + ')');
    console.log(mailer.isConfigured()
      ? 'Email: ready (' + mailer.describe() + ')'
      : 'Email: NOT configured - welcome emails will be printed here instead (see README).');
  });

  // Every 10 minutes, remove expired sessions, sign-ups and old lock-outs.
  setInterval(function () {
    Promise.all([security.cleanUp(), verification.cleanUp()]).catch(function (error) {
      console.error('Database clean-up failed: ' + error.message);
    });
  }, 10 * 60 * 1000).unref();
}).catch(function (error) {
  console.error('\nCannot connect to the database: ' + (error.code || '') + ' ' + error.message);
  console.error('Check that MySQL is started in the XAMPP Control Panel, that the "' + config.DB.database +
    '" database exists (run database/oceanbloom.sql in phpMyAdmin), and the DB_ settings in .env.\n');
  process.exit(1);
});
