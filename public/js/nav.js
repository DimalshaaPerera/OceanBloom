/*
 * nav.js - NAVIGATION BAR + LOGIN CHECK (for the logged-in pages)
 * ---------------------------------------------------------------
 * Every logged-in page (dashboard, game, leaderboard) calls Nav.init('pageName').
 * It asks the server "who am I?" (GET /api/me). If nobody is logged in the player
 * is sent to the login page. Otherwise it draws the top bar with links and a
 * log out button and returns the player's profile.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const Nav = {
  LINKS: [
    { id: 'dashboard', text: 'Dashboard', href: 'dashboard.html' },
    { id: 'game', text: 'Play', href: 'game.html' },
    { id: 'leaderboard', text: 'Leaderboard', href: 'leaderboard.html' }
  ],

  async init(activeId) {
    let profile;
    try {
      profile = await Backend.me();
    } catch (error) {
      window.location.href = 'login.html';
      return null;
    }

    const header = document.getElementById('siteHeader');
    header.textContent = '';

    const brand = document.createElement('a');
    brand.className = 'brand';
    brand.href = 'dashboard.html';
    brand.textContent = 'OceanBloom';
    header.appendChild(brand);

    const links = document.createElement('nav');
    links.className = 'navlinks';
    this.LINKS.forEach(function (item) {
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.text;
      if (item.id === activeId) { a.className = 'active'; }
      links.appendChild(a);
    });
    header.appendChild(links);

    const who = document.createElement('div');
    who.className = 'who';
    const name = document.createElement('span');
    name.textContent = profile.username;
    const out = document.createElement('button');
    out.type = 'button';
    out.className = 'small';
    out.textContent = 'Log out';
    out.addEventListener('click', function () {
      Backend.logout().then(function () {
        window.location.href = 'login.html';
      }).catch(function () {
        window.location.href = 'login.html';
      });
    });
    who.appendChild(name);
    who.appendChild(out);
    header.appendChild(who);

    return profile;
  }
};
