/*
 * mailer.js - SENDING EMAIL (interoperability with the Mailpit web API)
 * ---------------------------------------------------------------------
 * HIGH COHESION: the only file that sends email (verification codes and welcome
 * emails). It sends them to MAILPIT, a separate program written by someone else
 * (in Go) that runs next to our server. Mailpit offers a REST API: one HTTP POST
 * request with a JSON body. That is interoperability: our program cooperates with
 * someone else's system using an agreed protocol (HTTP) and data format (JSON).
 * No extra library is needed - Node's built-in fetch() does the job.
 *
 *   OceanBloom server --HTTP POST /api/v1/send (JSON)--> Mailpit (port 8025)
 *   --> test inbox at http://localhost:8025   (https://mailpit.axllent.org)
 *
 * Mailpit catches every email so it can be read in the browser; nothing is
 * delivered to real people, so any made-up address works while testing.
 *
 * Why the SERVER sends the email and not the web page: only the server decides
 * when an email is sent and what it says (for example the secret verification
 * code), so a player cannot use the page to send emails of their own.
 *
 * If EMAIL_PROVIDER is not "mailpit" in .env, the email is printed in the
 * terminal instead of being sent, and the game still works.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const config = require('./config');
const store = require('./store');

function fromAddress() {
  return config.EMAIL.fromAddress || 'no-reply@oceanbloom.local';
}

function isConfigured() {
  return config.EMAIL.provider === 'mailpit';
}

// Short text for the start-up message, e.g. "sending to Mailpit at http://localhost:8025".
function describe() {
  return 'sending to Mailpit at ' + config.EMAIL.mailpitUrl;
}

// The HTTP request in the JSON shape Mailpit's send API expects:
// https://mailpit.axllent.org/docs/api-v1/view.html#post-/api/v1/send
function buildRequest(user, message) {
  return {
    url: config.EMAIL.mailpitUrl + '/api/v1/send',
    headers: { 'content-type': 'application/json', 'accept': 'application/json' },
    body: {
      From: { Email: fromAddress(), Name: config.EMAIL.fromName },
      To: [{ Email: user.email, Name: user.name }],
      Subject: message.subject,
      Text: message.text,
      HTML: message.html,
      Tags: [message.tag]
    }
  };
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function buildWelcome(user) {
  const link = config.BASE_URL + '/login.html';
  const text =
    'Hi ' + user.name + ',\n\n' +
    'Welcome to OceanBloom! Your account is ready.\n\n' +
    'Username: ' + user.name + '\n\n' +
    'You start as a small fish in an empty ocean. Answer ocean questions against the clock, ' +
    'pass each level, and watch your fish grow while the ocean blooms. ' +
    'Climb the leaderboard to show who knows the sea best!\n\n' +
    'Play now: ' + link + '\n\n' +
    'Good luck,\nThe OceanBloom team\n';

  const html =
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0b2a40">' +
    '<h2 style="color:#12507d">Welcome to OceanBloom, ' + escapeHtml(user.name) + '!</h2>' +
    '<p>Your account is ready.</p>' +
    '<p><strong>Username:</strong> ' + escapeHtml(user.name) + '</p>' +
    '<p>You start as a small fish in an empty ocean. Answer ocean questions against the clock, ' +
    'pass each level, and watch your fish grow while the ocean blooms. ' +
    'Climb the leaderboard to show who knows the sea best!</p>' +
    '<p><a href="' + escapeHtml(link) + '" style="background:#ff9f43;color:#20150a;padding:10px 18px;' +
    'border-radius:8px;text-decoration:none;font-weight:bold">Play now</a></p>' +
    '<p>Good luck,<br>The OceanBloom team</p></div>';

  return { subject: 'Welcome to OceanBloom, ' + user.name + '!', text: text, html: html, tag: 'welcome' };
}

function buildVerification(user, code, minutes) {
  const text =
    'Hi ' + user.name + ',\n\n' +
    'Your OceanBloom verification code is:\n\n' +
    '    ' + code + '\n\n' +
    'Type it on the sign-up page to finish creating your account. ' +
    'The code expires in ' + minutes + ' minutes.\n\n' +
    'If you did not try to sign up, you can ignore this email.\n\n' +
    'The OceanBloom team\n';

  const html =
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0b2a40">' +
    '<h2 style="color:#12507d">Verify your email</h2>' +
    '<p>Hi ' + escapeHtml(user.name) + ', your OceanBloom verification code is:</p>' +
    '<p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#e8f6ff;' +
    'padding:14px 20px;border-radius:10px;text-align:center">' + escapeHtml(code) + '</p>' +
    '<p>Type it on the sign-up page to finish creating your account. ' +
    'The code expires in <strong>' + minutes + ' minutes</strong>.</p>' +
    '<p style="color:#5a7385;font-size:13px">If you did not try to sign up, you can ignore this email.</p>' +
    '<p>The OceanBloom team</p></div>';

  return { subject: code + ' is your OceanBloom verification code', text: text, html: html, tag: 'verification' };
}

// Returns { sent: true } or { sent: false, reason: '...' }. Never throws.
async function sendWelcomeEmail(user) {
  return send(user, buildWelcome(user));
}

// user = { name, email }. Same return value as sendWelcomeEmail.
async function sendVerificationCode(user, code, minutes) {
  return send(user, buildVerification(user, code, minutes));
}

// Sends one email and records the attempt in the email_log table.
async function send(user, message) {
  const result = await deliver(user, message);
  store.logEmail({
    userId: user.id, recipient: user.email, type: message.tag,
    provider: isConfigured() ? config.EMAIL.provider : 'terminal',
    sentOk: result.sent, error: result.error
  });
  return { sent: result.sent, reason: result.reason };
}

async function deliver(user, message) {
  if (!isConfigured()) {
    console.log('\n[email not configured - printing instead of sending]');
    console.log('To: ' + user.email + '\nSubject: ' + message.subject + '\n\n' + message.text);
    return { sent: false, reason: 'Email is not set up on the server yet.' };
  }

  try {
    // Ask Mailpit's web API to deliver the email.
    // A timeout stops a slow (or stopped) Mailpit freezing sign-up.
    const request = buildRequest(user, message);
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const detail = await response.text().catch(function () { return ''; });
      console.error('Mailpit answered HTTP ' + response.status + ': ' + detail.slice(0, 300));
      return { sent: false, reason: 'The email could not be sent.', error: 'HTTP ' + response.status + ' ' + detail };
    }
    console.log('Email (' + message.tag + ') sent to ' + user.email);
    return { sent: true };
  } catch (error) {
    console.error('Could not send email: ' + error.message +
      ' (is Mailpit running? Start it with: npm.cmd run mailpit)');
    return { sent: false, reason: 'The email could not be sent.', error: error.message };
  }
}

module.exports = { sendWelcomeEmail, sendVerificationCode, isConfigured, describe };
