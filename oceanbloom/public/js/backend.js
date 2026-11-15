/*
 * backend.js - TALKING TO OUR OWN SERVER
 * --------------------------------------
 * HIGH COHESION: the only client file that calls OceanBloom's own REST API
 * (/api/...). Pages call Backend.login(...), Backend.leaderboard(), etc. and never
 * write fetch() calls themselves. (The Fish Game picture is fetched in api.js.)
 *
 * If the server says "401 not logged in" (for example the session expired), the
 * player is sent to the login page automatically.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const Backend = {
  async request(method, url, body, redirectOn401) {
    const options = { method: method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(url, options);
    } catch (networkError) {
      throw new Error('Cannot reach the OceanBloom server. Is it running?');
    }

    let data = {};
    try {
      data = await response.json();
    } catch (e) {
      data = {};
    }

    if (response.status === 401 && redirectOn401) {
      window.location.href = 'login.html';
    }
    if (!response.ok) {
      const error = new Error(data.error || 'Server problem (' + response.status + ').');
      error.status = response.status;
      throw error;
    }
    return data;
  },

  // Registration step 1: check the details and email a 6-digit code.
  registerStart(username, email, password, confirmPassword) {
    return this.request('POST', '/api/register/start',
      { username: username, email: email, password: password, confirmPassword: confirmPassword }, false);
  },
  registerResend(pendingId) {
    return this.request('POST', '/api/register/resend', { pendingId: pendingId }, false);
  },
  // Registration step 2: check the code; the server creates the account and logs us in.
  registerVerify(pendingId, code) {
    return this.request('POST', '/api/register/verify', { pendingId: pendingId, code: code }, false);
  },
  login(username, password) {
    return this.request('POST', '/api/login', { username: username, password: password }, false);
  },
  logout() {
    return this.request('POST', '/api/logout', {}, false);
  },
  me() {
    return this.request('GET', '/api/me', undefined, false);
  },
  leaderboard() {
    return this.request('GET', '/api/leaderboard', undefined, true);
  },
  reportProgress(data) {
    return this.request('POST', '/api/progress', data, true);
  }
};
