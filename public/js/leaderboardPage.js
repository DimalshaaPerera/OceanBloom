/*
 * leaderboardPage.js - LEADERBOARD PAGE
 * -------------------------------------
 * Shows the top 10 players from GET /api/leaderboard (ranked by best score, then
 * highest level). The table refreshes by itself every 15 seconds (a timer event)
 * and when the Refresh button is pressed (a click event). Your own row is
 * highlighted.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
(async function () {
  const profile = await Nav.init('leaderboard');
  if (!profile) { return; }

  function $(id) { return document.getElementById(id); }

  async function refresh() {
    try {
      const data = await Backend.leaderboard();
      const body = $('lbBody');
      body.textContent = '';

      data.players.forEach(function (p) {
        const row = document.createElement('tr');
        if (p.username === profile.username) { row.className = 'me'; }
        [p.rank, p.username, p.bestScore, p.highestLevel + ' / 6', p.gamesCompleted].forEach(function (value) {
          const cell = document.createElement('td');
          cell.textContent = value;
          row.appendChild(cell);
        });
        body.appendChild(row);
      });

      $('lbTable').hidden = data.players.length === 0;
      $('lbEmpty').hidden = data.players.length > 0;
      $('lbInfo').textContent = data.total + ' player' + (data.total === 1 ? '' : 's') +
        ' so far. Updated ' + new Date().toLocaleTimeString() + '.';
    } catch (error) {
      $('lbInfo').textContent = error.message;
    }
  }

  $('refreshBtn').addEventListener('click', refresh);
  setInterval(refresh, 15000);
  refresh();
})();
