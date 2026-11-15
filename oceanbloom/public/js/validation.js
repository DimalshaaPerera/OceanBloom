/*
 * validation.js - CREDENTIAL RULES (shared by the browser AND the server)
 * ----------------------------------------------------------------------
 * One file, used in two places:
 *   - the login page loads it with a <script> tag to give instant feedback
 *     (the live password checklist, "passwords do not match", ...)
 *   - the server loads it with require() and checks everything AGAIN, because
 *     anything checked only in the browser can be bypassed.
 * Keeping the rules in one place means the two can never disagree.
 *
 * Password standard (based on the OWASP Authentication Cheat Sheet):
 *   8-64 characters, an uppercase letter, a lowercase letter, a number and a
 *   symbol, no spaces, must not contain the username, must not be a common password.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const Validation = (function () {
  const USERNAME = /^[A-Za-z0-9_]{3,15}$/;
  const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
  const OTP = /^[0-9]{6}$/;
  const PASSWORD_MIN = 8;
  const PASSWORD_MAX = 64;

  // Words that make a password easy to guess, even with numbers and symbols added
  // ("Password@123" becomes "password" once the non-letters are removed).
  const COMMON_WORDS = [
    'password', 'passw', 'pass', 'qwerty', 'qwertyuiop', 'asdfgh', 'abc', 'abcd', 'abcdef',
    'letmein', 'welcome', 'admin', 'administrator', 'iloveyou', 'monkey', 'dragon', 'football',
    'baseball', 'sunshine', 'princess', 'login', 'master', 'hello', 'freedom', 'whatever',
    'trustno', 'shadow', 'superman', 'batman', 'starwars', 'secret', 'test', 'user',
    'oceanbloom', 'ocean', 'fish'
  ];

  function isCommon(password) {
    const letters = password.toLowerCase().replace(/[^a-z]/g, '');
    return letters.length === 0 || COMMON_WORDS.indexOf(letters) !== -1;
  }

  // Every password rule with whether it is met. The page shows this as a checklist.
  function passwordChecks(password, username) {
    const p = String(password || '');
    const u = String(username || '').trim().toLowerCase();
    return [
      { id: 'length', text: PASSWORD_MIN + '-' + PASSWORD_MAX + ' characters',
        ok: p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX },
      { id: 'upper', text: 'An uppercase letter (A-Z)', ok: /[A-Z]/.test(p) },
      { id: 'lower', text: 'A lowercase letter (a-z)', ok: /[a-z]/.test(p) },
      { id: 'number', text: 'A number (0-9)', ok: /[0-9]/.test(p) },
      { id: 'symbol', text: 'A symbol, e.g. ! @ # $ %', ok: /[^A-Za-z0-9\s]/.test(p) },
      { id: 'spaces', text: 'No spaces', ok: p.length > 0 && !/\s/.test(p) },
      { id: 'username', text: 'Does not contain your username',
        ok: p.length > 0 && (u.length < 3 || p.toLowerCase().indexOf(u) === -1) },
      { id: 'common', text: 'Not a common password (like Password@123)', ok: p.length > 0 && !isCommon(p) }
    ];
  }

  // Each check* function returns '' when the value is fine, otherwise an error message.
  function checkUsername(username) {
    const u = String(username || '').trim();
    if (u.length === 0) { return 'Please enter a username.'; }
    if (!USERNAME.test(u)) { return 'Username must be 3-15 letters, numbers or underscores.'; }
    return '';
  }

  function checkEmail(email) {
    const e = String(email || '').trim();
    if (e.length === 0) { return 'Please enter your email address.'; }
    if (e.length > 100 || !EMAIL.test(e)) { return 'Please enter a valid email address, e.g. name@example.com.'; }
    return '';
  }

  function checkPassword(password, username) {
    if (String(password || '').length === 0) { return 'Please enter a password.'; }
    const failed = passwordChecks(password, username).filter(function (c) { return !c.ok; });
    return failed.length === 0 ? '' : 'Password needs: ' + failed.map(function (c) { return c.text; }).join(', ') + '.';
  }

  function checkConfirm(password, confirm) {
    if (String(confirm || '').length === 0) { return 'Please type your password again.'; }
    return password === confirm ? '' : 'The two passwords do not match.';
  }

  function checkOtp(code) {
    return OTP.test(String(code || '').trim()) ? '' : 'Enter the 6-digit code from the email.';
  }

  // Login only checks the shape, not the full password standard
  // (the server decides whether the password is right).
  function checkLogin(username, password) {
    return {
      username: checkUsername(username),
      password: String(password || '').length === 0 ? 'Please enter your password.'
        : String(password).length > 128 ? 'That password is too long.' : ''
    };
  }

  return {
    PASSWORD_MIN: PASSWORD_MIN, PASSWORD_MAX: PASSWORD_MAX,
    passwordChecks: passwordChecks, checkUsername: checkUsername, checkEmail: checkEmail,
    checkPassword: checkPassword, checkConfirm: checkConfirm, checkOtp: checkOtp, checkLogin: checkLogin
  };
})();

// Lets the server use this same file with require().
if (typeof module !== 'undefined' && module.exports) { module.exports = Validation; }
