/*
 * config.js - SETTINGS
 * --------------------
 * Reads settings from a file called ".env" in the project folder (if it exists)
 * and from the computer's environment variables. Secrets such as the email
 * password live in .env, NEVER in the code, so they are not shared by accident.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) { return; }
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(function (line) {
    const text = line.trim();
    if (!text || text.startsWith('#')) { return; }
    const eq = text.indexOf('=');
    if (eq < 1) { return; }
    const key = text.slice(0, eq).trim();
    let value = text.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) { process.env[key] = value; }
  });
}

loadEnvFile();
const env = process.env;

const port = Number(env.PORT) || 3000;

module.exports = {
  PORT: port,
  BASE_URL: env.BASE_URL || 'http://localhost:' + port,
  DATA_DIR: env.DATA_DIR || path.join(__dirname, '..', 'data'),
  FISH_API_URL: env.FISH_API_URL || 'https://marcconrad.com/uob/fish/api.php?out=json',
  // Email web API (Brevo). Leave BREVO_API_KEY empty to print emails in the terminal instead.
  EMAIL: {
    apiUrl: env.EMAIL_API_URL || 'https://api.brevo.com/v3/smtp/email',
    apiKey: (env.BREVO_API_KEY || '').trim(),
    fromAddress: (env.MAIL_FROM_ADDRESS || '').trim(),
    fromName: (env.MAIL_FROM_NAME || 'OceanBloom').trim()
  }
};
