/*
 * loginPage.js - LOGIN / REGISTER PAGE
 * ------------------------------------
 * EVENT-DRIVEN: reacts to clicks on the two tabs and to the two forms being
 * submitted. The checks that really matter (is the password right? is the
 * username free?) are done by the SERVER, because anything checked only in the
 * browser can be bypassed by the user.
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

  // Already logged in? Skip this page.
  Backend.me().then(function () {
    window.location.href = 'dashboard.html';
  }).catch(function () { /* not logged in: stay here */ });

  function showMessage(text, kind) {
    $('authMsg').textContent = text;
    $('authMsg').className = 'msg ' + (kind || '');
  }

  function showTab(name) {
    $('loginForm').hidden = name !== 'login';
    $('registerForm').hidden = name !== 'register';
    $('tabLogin').classList.toggle('active', name === 'login');
    $('tabRegister').classList.toggle('active', name === 'register');
    showMessage('', '');
  }

  $('tabLogin').addEventListener('click', function () { showTab('login'); });
  $('tabRegister').addEventListener('click', function () { showTab('register'); });

  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const button = $('loginBtn');
    button.disabled = true;
    showMessage('Logging in...', '');
    try {
      await Backend.login($('loginUser').value, $('loginPass').value);
      window.location.href = 'dashboard.html';
    } catch (error) {
      showMessage(error.message, 'bad');
      button.disabled = false;
    }
  });

  $('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const button = $('registerBtn');
    const email = $('regEmail').value.trim();
    button.disabled = true;
    showMessage('Creating your account and sending your welcome email...', '');
    try {
      const result = await Backend.register($('regUser').value, email, $('regPass').value);
      // The dashboard shows this note once.
      sessionStorage.setItem('welcomeNote', result.emailSent
        ? 'Welcome aboard! A confirmation email was sent to ' + email + '.'
        : 'Welcome aboard! Your account is ready, but the welcome email could not be sent (' +
          (result.emailNote || 'unknown reason') + ').');
      window.location.href = 'dashboard.html';
    } catch (error) {
      showMessage(error.message, 'bad');
      button.disabled = false;
    }
  });
})();
