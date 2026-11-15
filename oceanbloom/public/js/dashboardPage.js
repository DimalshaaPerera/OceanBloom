/*
 * dashboardPage.js - DASHBOARD PAGE
 * ---------------------------------
 * Shows the player's own statistics (from GET /api/me): highest level, best score,
 * leaderboard rank, completed games, mistakes and recent games. It also draws the
 * player's current ocean using the same Ocean file as the game - at the highest
 * level they have reached - which is a nice example of reusing one cohesive file
 * in two places.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
(async function () {
  const profile = await Nav.init('dashboard');
  if (!profile) { return; }

  function $(id) { return document.getElementById(id); }
  const s = profile.stats;
  const TOTAL_LEVELS = 6;

  $('welcome').textContent = 'Welcome back, ' + profile.username + '!';

  const note = sessionStorage.getItem('welcomeNote');
  if (note) {
    $('banner').textContent = note;
    $('banner').hidden = false;
    sessionStorage.removeItem('welcomeNote');
  }

  $('statLevel').textContent = s.highestLevel ? s.highestLevel + ' / ' + TOTAL_LEVELS : 'Not started';
  $('statBest').textContent = s.bestScore;
  $('statRank').textContent = profile.rank ? '#' + profile.rank + ' of ' + profile.totalPlayers : '-';
  $('statGames').textContent = s.gamesCompleted;
  $('statMistakes').textContent = s.totalMistakes;
  $('levelFill').style.width = (s.highestLevel / TOTAL_LEVELS * 100) + '%';
  $('levelText').textContent = s.highestLevel
    ? 'You have reached level ' + s.highestLevel + ' of ' + TOTAL_LEVELS + '.'
    : 'Play your first game to start growing your fish!';

  $('acctEmail').textContent = profile.email;
  $('acctSince').textContent = new Date(profile.createdAt).toLocaleDateString();

  // Recent completed games
  const body = $('recentBody');
  body.textContent = '';
  s.recent.forEach(function (game) {
    const row = document.createElement('tr');
    [new Date(game.at).toLocaleString(), game.score, game.mistakes].forEach(function (value) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  $('recentTable').hidden = s.recent.length === 0;
  $('noGames').hidden = s.recent.length > 0;

  // The player's ocean, as far as they have got
  Ocean.init($('ocean'));
  Ocean.setLevel(Math.max(1, s.highestLevel), true);
  Sound.setMood(Math.max(1, s.highestLevel));      // the music matches the player's reef
})();
