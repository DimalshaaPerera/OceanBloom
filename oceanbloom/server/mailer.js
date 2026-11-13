/*
 * mailer.js - SENDING EMAIL (interoperability with an email web API)
 * ------------------------------------------------------------------
 * HIGH COHESION: the only file that sends email. It talks to the Brevo email
 * service (https://developers.brevo.com/reference/sendtransacemail) using a
 * REST API: one HTTPS POST request with a JSON body, authenticated with an API key.
 * That is interoperability: our program cooperates with someone else's system
 * using an agreed protocol (HTTPS) and data format (JSON). No extra library is
 * needed - Node's built-in fetch() does the job.
 *
 *   OceanBloom server  --HTTPS POST (JSON + api-key header)-->  Brevo  --> player's inbox
 *
 * Why the SERVER sends the email and not the web page: the API key is a secret.
 * Code in a web page can be read by anyone, so the key stays on the server
 * (in the .env file).
 *
 * If no API key is given, the email is printed in the terminal instead of being
 * sent, and the game still works.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const config = require('./config');

function isConfigured() {
  return Boolean(config.EMAIL.apiKey && config.EMAIL.fromAddress);
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

  return { subject: 'Welcome to OceanBloom, ' + user.name + '!', text: text, html: html };
}

// Returns { sent: true } or { sent: false, reason: '...' }. Never throws.
async function sendWelcomeEmail(user) {
  const message = buildWelcome(user);

  if (!isConfigured()) {
    console.log('\n[email not configured - printing instead of sending]');
    console.log('To: ' + user.email + '\nSubject: ' + message.subject + '\n\n' + message.text);
    return { sent: false, reason: 'Email is not set up on the server yet.' };
  }

  try {
    // Ask Brevo's web API to send the email. A timeout stops a slow service freezing sign-up.
    const response = await fetch(config.EMAIL.apiUrl, {
      method: 'POST',
      headers: {
        'api-key': config.EMAIL.apiKey,
        'content-type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: config.EMAIL.fromName, email: config.EMAIL.fromAddress },
        to: [{ email: user.email, name: user.name }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const detail = await response.text().catch(function () { return ''; });
      console.error('Email API answered HTTP ' + response.status + ': ' + detail.slice(0, 300));
      return { sent: false, reason: 'The email could not be sent.' };
    }
    console.log('Welcome email sent to ' + user.email);
    return { sent: true };
  } catch (error) {
    console.error('Could not send email: ' + error.message);
    return { sent: false, reason: 'The email could not be sent.' };
  }
}

module.exports = { sendWelcomeEmail, isConfigured };
