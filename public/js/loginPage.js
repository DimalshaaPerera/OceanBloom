/*
 * loginPage.js - LOGIN / REGISTER PAGE
 * ------------------------------------
 * EVENT-DRIVEN: reacts to clicks on the tabs, typing in the fields and the forms
 * being submitted.
 *
 * Registration has two steps:
 *   1. details form  -> POST /api/register/start   (the server emails a 6-digit code)
 *   2. code form     -> POST /api/register/verify  (the server creates the account; we show
 *                       a success message and switch back to the login form)
 *
 * The rules come from validation.js, the SAME file the server uses. Checking here
 * gives instant feedback; the server checks everything again, because anything
 * checked only in the browser can be bypassed by the user.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
(function () {
  function $(id) { return document.getElementById(id); }

  // The finished reef (level 6) swims behind the form. Move the mouse and the fish follows.
  Ocean.init($('ocean'));
  Ocean.setLevel(6, true);
  Ocean.scale = Ocean.targetScale = 1.5;   // a smaller fish here, so it does not cover the form
  Sound.setMood(6);                        // the finished reef gets the brightest music

  // Already logged in? Skip this page.
  Backend.me().then(function () {
    window.location.href = 'dashboard.html';
  }).catch(function () { /* not logged in: stay here */ });

  /* ---------- messages and field errors ---------- */

  function showMessage(text, kind) {
    $('authMsg').textContent = text;
    $('authMsg').className = 'msg ' + (kind || '');
    if (text && kind === 'ok') { Sound.play('correct'); }
    if (text && kind === 'bad') { Sound.play('wrong'); }
  }

  // Shows (or clears) the error under one input. Returns true when the field is fine.
  function setFieldError(inputId, message) {
    const input = $(inputId);
    const error = $(inputId + 'Err');
    if (error) { error.textContent = message || ''; }   // never let a missing element block a button
    input.classList.toggle('invalid', Boolean(message));
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    input.dataset.touched = 'yes';   // from now on, re-check while the player types
    return !message;
  }

  function clearErrors(form) {
    form.querySelectorAll('input').forEach(function (input) {
      input.classList.remove('invalid');
      input.removeAttribute('aria-invalid');
      delete input.dataset.touched;
      const error = $(input.id + 'Err');
      if (error) { error.textContent = ''; }
    });
  }

  // Check a field when the player leaves it, and again on every key once it has been checked.
  function liveCheck(inputId, check) {
    $(inputId).addEventListener('blur', function () {
      if ($(inputId).value !== '') { setFieldError(inputId, check()); }
    });
    $(inputId).addEventListener('input', function () {
      if ($(inputId).dataset.touched) { setFieldError(inputId, check()); }
    });
  }

  /* ---------- tabs and steps ---------- */

  let timer = null;
  let verifying = false;   // true while the code is being checked, so it cannot be sent twice
  let pendingId = null;
  let expiresAt = 0;
  let resendAt = 0;

  function showView(name) {
    $('loginForm').hidden = name !== 'login';
    $('registerForm').hidden = name !== 'register';
    $('otpForm').hidden = name !== 'otp';
    $('tabLogin').classList.toggle('active', name === 'login');
    $('tabRegister').classList.toggle('active', name !== 'login');
    showMessage('', '');
    if (name !== 'otp') { stopTimer(); }
  }

  $('tabLogin').addEventListener('click', function () { showView('login'); });
  $('tabRegister').addEventListener('click', function () { showView(pendingId ? 'otp' : 'register'); if (pendingId) { startTimer(); } });

  // "Show" / "Hide" buttons next to password fields.
  document.querySelectorAll('.toggle-pass').forEach(function (button) {
    button.addEventListener('click', function () {
      const input = $(button.dataset.for);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      input.focus();
    });
  });

  /* ---------- log in ---------- */

  function loginChecks() {
    return Validation.checkLogin($('loginUser').value, $('loginPass').value);
  }
  liveCheck('loginUser', function () { return loginChecks().username; });
  liveCheck('loginPass', function () { return loginChecks().password; });

  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const problems = loginChecks();
    const userOk = setFieldError('loginUser', problems.username);
    const passOk = setFieldError('loginPass', problems.password);
    if (!userOk || !passOk) {
      showMessage('Please fix the highlighted fields.', 'bad');
      $(userOk ? 'loginPass' : 'loginUser').focus();
      return;
    }

    const button = $('loginBtn');
    button.disabled = true;
    showMessage('Logging in...', '');
    try {
      await Backend.login($('loginUser').value.trim(), $('loginPass').value);
      window.location.href = 'dashboard.html';
    } catch (error) {
      showMessage(error.message, 'bad');
      $('loginPass').value = '';
      $('loginPass').focus();
      button.disabled = false;
    }
  });

  /* ---------- register, step 1: details ---------- */

  function drawPasswordRules() {
    const checks = Validation.passwordChecks($('regPass').value, $('regUser').value);
    const passed = checks.filter(function (c) { return c.ok; }).length;
    const list = $('pwRules');
    list.textContent = '';
    checks.forEach(function (c) {
      const item = document.createElement('li');
      item.className = c.ok ? 'ok' : '';
      item.textContent = (c.ok ? '✓ ' : '• ') + c.text;
      list.appendChild(item);
    });
    const bar = $('strengthBar');
    const ratio = $('regPass').value === '' ? 0 : passed / checks.length;
    bar.style.width = Math.round(ratio * 100) + '%';
    bar.className = ratio === 1 ? 'strong' : ratio >= 0.6 ? 'medium' : 'weak';
  }

  const registerChecks = {
    regUser: function () { return Validation.checkUsername($('regUser').value); },
    regEmail: function () { return Validation.checkEmail($('regEmail').value); },
    regPass: function () { return Validation.checkPassword($('regPass').value, $('regUser').value); },
    regConfirm: function () { return Validation.checkConfirm($('regPass').value, $('regConfirm').value); }
  };
  Object.keys(registerChecks).forEach(function (id) { liveCheck(id, registerChecks[id]); });

  // The username and password affect each other's rules, so redraw on both.
  ['regPass', 'regUser'].forEach(function (id) {
    $(id).addEventListener('input', function () {
      drawPasswordRules();
      if ($('regPass').dataset.touched) { setFieldError('regPass', registerChecks.regPass()); }
      if ($('regConfirm').dataset.touched) { setFieldError('regConfirm', registerChecks.regConfirm()); }
    });
  });
  drawPasswordRules();

  $('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    let firstBad = null;
    Object.keys(registerChecks).forEach(function (id) {
      if (!setFieldError(id, registerChecks[id]()) && !firstBad) { firstBad = id; }
    });
    if (firstBad) {
      showMessage('Please fix the highlighted fields.', 'bad');
      $(firstBad).focus();
      return;
    }

    const button = $('registerBtn');
    const email = $('regEmail').value.trim();
    button.disabled = true;
    showMessage('Sending your verification code...', '');
    try {
      const result = await Backend.registerStart($('regUser').value.trim(), email,
        $('regPass').value, $('regConfirm').value);
      pendingId = result.pendingId;
      $('otpEmail').textContent = result.email;
      $('otpCode').value = '';
      clearErrors($('otpForm'));
      showView('otp');
      setTimes(result);
      showMessage(result.note || 'Code sent! Check your inbox (and the spam folder).', result.note ? '' : 'ok');
      $('otpCode').focus();
    } catch (error) {
      showMessage(error.message, 'bad');
      // Point at the field the server complained about.
      if (/username/i.test(error.message)) { setFieldError('regUser', error.message); $('regUser').focus(); }
      else if (/email/i.test(error.message)) { setFieldError('regEmail', error.message); $('regEmail').focus(); }
    } finally {
      button.disabled = false;
    }
  });

  /* ---------- register, step 2: the code ---------- */

  function formatSeconds(s) {
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function setTimes(result) {
    expiresAt = Date.now() + result.expiresInSeconds * 1000;
    resendAt = Date.now() + result.resendInSeconds * 1000;
    startTimer();
  }

  function tick() {
    const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    const wait = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
    $('otpExpiry').textContent = left > 0 ? formatSeconds(left) : 'now - it has expired';
    $('resendBtn').disabled = verifying || wait > 0;
    $('resendBtn').textContent = wait > 0 ? 'Resend code (' + wait + 's)' : 'Resend code';
    $('otpBtn').disabled = verifying || left === 0;
  }

  function startTimer() {
    stopTimer();
    tick();
    timer = setInterval(tick, 1000);
  }

  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function backToDetails(message) {
    pendingId = null;
    showView('register');
    if (message) { showMessage(message, 'bad'); }
  }

  // Digits only. The code is sent when the player clicks "Verify and create account" (or presses Enter).
  $('otpCode').addEventListener('input', function () {
    const digits = $('otpCode').value.replace(/\D/g, '').slice(0, 6);
    if ($('otpCode').value !== digits) { $('otpCode').value = digits; }
    if ($('otpCode').dataset.touched) { setFieldError('otpCode', Validation.checkOtp(digits)); }
    if (digits.length === 6) { showMessage('Code entered - click "Verify and create account".', ''); }
  });

  $('otpForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (verifying) { return; }   // already checking: ignore extra clicks
    const code = $('otpCode').value.trim();
    if (!setFieldError('otpCode', Validation.checkOtp(code))) { $('otpCode').focus(); return; }

    const button = $('otpBtn');
    verifying = true;
    button.disabled = true;
    $('resendBtn').disabled = true;
    $('backBtn').disabled = true;
    button.textContent = 'Verifying...';
    showMessage('Checking your code...', '');
    try {
      const result = await Backend.registerVerify(pendingId, code);
      // The account now exists. Reset the sign-up steps and send the player to the login form.
      verifying = false;
      pendingId = null;
      button.textContent = 'Verify and create account';
      $('backBtn').disabled = false;
      $('registerForm').reset();
      clearErrors($('registerForm'));
      drawPasswordRules();
      showView('login');
      clearErrors($('loginForm'));
      $('loginUser').value = result.username;
      $('loginPass').value = '';
      showMessage('Registration successful! Your email is verified' +
        (result.emailSent ? ' and a welcome email is on its way' : '') +
        '. Please log in with your new account.', 'ok');
      $('loginPass').focus();
    } catch (error) {
      verifying = false;
      button.textContent = 'Verify and create account';
      $('backBtn').disabled = false;
      tick();
      $('otpCode').value = '';
      // 410 = expired, 429 = too many tries, 409 = name/email taken meanwhile: start again.
      if (error.status === 410 || error.status === 429 || error.status === 409) {
        backToDetails(error.message);
      } else {
        setFieldError('otpCode', error.message);
        showMessage(error.message, 'bad');
        $('otpCode').focus();
      }
    }
  });

  $('resendBtn').addEventListener('click', async function () {
    $('resendBtn').disabled = true;
    showMessage('Sending a new code...', '');
    try {
      const result = await Backend.registerResend(pendingId);
      setTimes(result);
      $('otpCode').value = '';
      clearErrors($('otpForm'));
      showMessage(result.note || 'A new code is on its way. Only the newest code works.', result.note ? '' : 'ok');
      $('otpCode').focus();
    } catch (error) {
      if (error.status === 410 || (error.status === 429 && /form again/.test(error.message))) {
        backToDetails(error.message);
      } else {
        showMessage(error.message, 'bad');
        tick();
      }
    }
  });

  $('backBtn').addEventListener('click', function () { backToDetails(''); });
})();
