# OceanBloom

A browser game for CIS045-3 (Distributed Service Architectures). You start as a small fish in an empty, dark ocean. Answer ocean questions against the clock: every level you pass makes the fish **bigger and changes its look**, and the ocean fills with **colour, creatures and life**. There are separate **login**, **game**, **dashboard** and **leaderboard** pages, and a **welcome email** is sent when you register.

## Rules

- Each level has 3 questions: **2 ocean quiz questions** (multiple choice) and then a **Feeding time** challenge (the Fish Game web service gives a picture of fish: count them, then work out how many shrimp they need - 1 shrimp each on levels 1-2, 2 each on levels 3-4, 3 each on levels 5-6).
- Every question has a **countdown**. Levels get harder: quiz difficulty goes easy -> medium -> hard and the time limit shrinks.
- You must answer **all 3 questions of a level correctly in a row**. A wrong answer or running out of time means you are **stuck**: you go back to the start of that level and cannot move on until you pass it.
- Score: 10 x level per correct answer + 1 point per second left; a wrong answer costs 5 points from your banked score.

## What you see at each level

| Level | Name | Ocean | Your fish |
| --- | --- | --- | --- |
| 1 | Lonely Water | Empty, dark water with drifting specks | Small orange fish (it blows a bubble now and then) |
| 2 | Bubble Bay | Sunbeams, dancing light, bubbles, glowing dust, surface waves, a jellyfish | Bigger, pink, white stripes |
| 3 | Kelp Garden | Hills, sandy floor, rocks, swaying seaweed, a sea turtle, a crab | Bigger, yellow, soft glow and a shadow on the sand |
| 4 | Coral Courtyard | Coral, anemones, starfish, a seahorse, a manta ray | Bigger, purple, a big top fin |
| 5 | Reef Parade | A whale far away, a school of little fish, a second jellyfish, an octopus, a clam with a pearl | Bigger, red |
| 6 | Treasure Lagoon | Open treasure chest, brightest water | Biggest, rainbow colours, golden crown, sparkle trail |

**Pause:** the **Pause** button in the bar above the question (or the **P** / **Esc** key) stops the countdown, freezes the ocean and hides the question until you press **Resume**, so pausing cannot be used to get extra thinking time. Switching to another tab or window pauses the game automatically.

Extras: move the mouse over the ocean and **the fish swims after it**. A correct answer makes the fish **jump with hearts**; a wrong answer makes it **shake and the screen flashes red**; passing a level shows a **banner, confetti and light rings**; winning makes **confetti rain and fireworks**. Click the water and the fish **darts there in a burst of bubbles**. On the Feeding time question a **shark swims through the reef**, and in the last 5 seconds of any countdown the ocean edges **pulse red**.

**Sound:** every sound is generated in the browser with the Web Audio API (`public/js/sound.js`, no audio files): button clicks, a sonar ping for each new question, a happy chime for a correct answer, a low "bwomp" for a wrong one, clock ticks in the last 5 seconds, an alarm on time-out, a shark whoosh, a level-up fanfare and a victory tune with fireworks. Calm ocean music (waves plus soft notes with an echo) plays in the background and gets brighter as your level rises. The two round buttons in the bottom-right corner turn **effects** and **music** on or off, and the choice is remembered. Browsers only allow sound after your first click on the page. The login page shows the finished reef behind the form.

## Quick start (Windows, step by step)

You need **Node.js** (a program that runs the game's server).

1. Download and install the **LTS** version from https://nodejs.org (accept the defaults). Then **close and reopen VS Code**.
2. Unzip `oceanbloom.zip`. In VS Code choose **File -> Open Folder** and pick the folder that **directly contains `package.json`** (there may be two folders with the same name - open the inner one).
3. Open a terminal: **Terminal -> New Terminal**. Type `dir` - you must see `package.json`, `server` and `public`.
4. Install (only needed once; it downloads mysql2, the database driver): `npm.cmd install`
4b. Start **MySQL** in the XAMPP Control Panel and create the database once (see "Where the data is" below).
5. Start the game: `npm.cmd start` - you should see `OceanBloom is running at http://localhost:3000` and `Database: connected to "oceanbloom"`.
6. Open **http://localhost:3000** in Chrome or Edge (type `http://`, not `https://`).
7. To stop the server later, click in the terminal and press **Ctrl+C**.

(`npm.cmd` instead of `npm` avoids a common PowerShell error "running scripts is disabled". On Mac/Linux just use `npm`.)

The server must be running whenever you play. If you change a file, stop the server (Ctrl+C), run `npm.cmd start` again and refresh the browser. Do not use the "Go Live" button - this version needs its own server.

You need an internet connection for the Feeding time challenge (Fish Game service) and for real emails.

## Automatic tests

`npm.cmd test` runs 38 checks on the game rules, the question bank and the credential rules (no browser needed). Screenshot the result as evidence of testing.

## The welcome email (Mailpit locally, or the Brevo email API)

`EMAIL_PROVIDER` in `.env` chooses where welcome emails go. If nothing is set up, registration still works and the email is simply **printed in the terminal**.

### Option A: Mailpit (local test inbox, recommended while developing)

[Mailpit](https://mailpit.axllent.org) runs on your computer and catches every email so you can read it in the browser. Nothing is sent to real people, so any made-up address works.

1. Get Mailpit: download `mailpit-windows-amd64.zip` from https://github.com/axllent/mailpit/releases and unzip `mailpit.exe` into `tools/mailpit/` (this folder is git-ignored).
2. Copy `.env.example` to `.env` (same folder as `package.json`). It already has `EMAIL_PROVIDER=mailpit`.
3. In a **second terminal** run `npm.cmd run mailpit` and leave it running.
4. In the first terminal run `npm.cmd start`. It should say `Email: ready (sending to Mailpit at http://localhost:8025)`.
5. Register a new account, then open http://localhost:8025 to see the welcome email.

The server sends to Mailpit with an HTTP POST + JSON to its send API (`/api/v1/send`), the same REST style used for Brevo.

### Option B: Brevo (real emails, free plan 300 a day)

1. Create a free account at https://www.brevo.com
2. Add your own email address as a **sender** (Senders, Domains & Dedicated IPs -> Senders) and click the verification link Brevo emails you.
3. Create an **API key** (top-right menu -> SMTP & API -> API Keys -> Generate a new API key). Copy it.
4. In `.env` set `EMAIL_PROVIDER=brevo`, fill in `BREVO_API_KEY` (the key) and set `MAIL_FROM_ADDRESS` to the sender you verified.
5. Stop the server (Ctrl+C) and run `npm.cmd start` again. It should now say `Email: ready (sending through the Brevo API)`.
6. Register a new account with a real email address you can open. Check the inbox and the **spam folder**.

**Never share `.env` or put it in your submission** - it contains your API key.

## Where the data is (MySQL / MariaDB database)

Everything is saved in a MySQL database called `oceanbloom` (XAMPP's MariaDB works):

| Table | What it holds |
|---|---|
| `users` | Accounts: username, email, password salt + scrypt hash (never the password), email verified |
| `player_stats` | Best score, highest level, games completed, total mistakes (made automatically by a trigger) |
| `game_results` | One row per finished game (the dashboard's recent games) |
| `sessions` | Who is logged in: only a SHA-256 hash of the cookie token; logins survive a server restart |
| `email_verifications` | Sign-ups waiting for their 6-digit code (only a hash of the code) |
| `login_attempts` | Wrong passwords per IP + username, for the 30-second lock-out |
| `email_log` | Every verification / welcome email the server tried to send |
| `leaderboard` (view) | Players ranked by best score, then highest level |

**Set it up once:**
1. XAMPP Control Panel -> **Start** MySQL (and Apache, for phpMyAdmin).
2. Open http://localhost/phpmyadmin -> **SQL** tab -> paste all of `database/oceanbloom.sql` -> **Go**. (Running it again wipes all data.)
3. The connection settings are the `DB_...` lines in `.env` (XAMPP default: user `root`, empty password).
4. Had players in the old `data/users.json`? Run `npm.cmd run db:import` once to copy them in (same passwords; safe to run twice).

Every SQL statement uses `?` placeholders (prepared statements), so player input can never be run as SQL (no SQL injection). Only `server/db.js` connects to the database.

## Project structure

| File | Single responsibility | Assignment theme |
| --- | --- | --- |
| `server/server.js` | Web server and REST API (`/api/...`), page guard | Interoperability, identity |
| `server/security.js` | Password hashing (scrypt), sessions, HttpOnly cookie, lock-out | Virtual identity |
| `server/verification.js` | Email verification: 6-digit one-time code (OTP), expiry, attempt and resend limits | Virtual identity |
| `public/js/validation.js` | Username, email, password and OTP rules, shared by the page and the server | High cohesion |
| `server/mailer.js` | Sends the verification-code and welcome emails to Mailpit (local) or the Brevo REST API (fetch + JSON) | Interoperability |
| `server/db.js` | The MySQL connection pool, prepared statements and transactions | High cohesion |
| `server/store.js` | Reads and writes users, statistics, results and the leaderboard (SQL) | High cohesion |
| `database/oceanbloom.sql` | Creates the database: tables, keys, trigger, leaderboard view | |
| `database/import-json.js` | One-time copy of old `data/users.json` accounts into MySQL | |
| `server/config.js` | Reads settings and secrets from `.env` | High cohesion |
| `public/login.html` + `js/loginPage.js` | Login / two-step register page (details, then email code) | Event-driven programming |
| `public/game.html` + `js/main.js` | Game page controller, wires components together | Low coupling |
| `public/dashboard.html` + `js/dashboardPage.js` | Player statistics | - |
| `public/leaderboard.html` + `js/leaderboardPage.js` | Top players | - |
| `public/js/events.js` | Event bus (publish/subscribe) | Event-driven programming |
| `public/js/timer.js` | Countdown; announces `timer:tick` and `timer:expired` | Event-driven programming |
| `public/js/game.js` | Game rules: levels, stuck-on-wrong, score (no screen code) | Low coupling / high cohesion |
| `public/js/questions.js` | Ocean question bank by difficulty | High cohesion |
| `public/js/ocean.js` | The animated scene: what appears at each level, fish movement, effects | High cohesion |
| `public/js/creatures.js` | Drawing helpers: fish, jellyfish, turtle, seahorse, whale, chest | High cohesion |
| `public/js/ui.js` | Reads/writes the game page's HTML | Event-driven programming |
| `public/js/api.js` | Fetches the Feeding time picture through our server | Interoperability |
| `public/js/backend.js` | The only client file that calls our own `/api/...` | High cohesion |
| `public/js/nav.js` | Shared menu, checks the player is logged in | High cohesion |
| `public/css/style.css` | Colours, animations, layout | - |
| `tests/game.test.js` | Automatic tests of rules and questions | Low coupling (testable) |

## Third-party services and code (REFERENCES)

- Fish Game API by Marc Conrad: https://marcconrad.com/uob/fish/doc.php (HTTPS GET, JSON). Called by our server, not directly by the browser.
- Brevo transactional email API (HTTPS POST, JSON): https://developers.brevo.com/reference/sendtransacemail
- Mailpit send API (HTTP POST, JSON): https://mailpit.axllent.org/docs/api-v1/
- Node.js built-in modules: `http`, `fs`, `path`, `crypto` (scrypt, random tokens).
- Browser built-ins: `fetch`, Canvas 2D, CSS animations.
- Ocean quiz questions: a local bank (`public/js/questions.js`) written for this project from general knowledge. **Student: check the answers yourself and add a few of your own.**
- **Generative AI:** the first draft of the code (including the animated scene) was generated with Claude (Anthropic) in October-November 2026 from prompts describing the assignment and my game idea. I then read, ran and modified it. (**Student: list here exactly what you changed or wrote yourself, e.g. "I added questions, changed the colours and timings, ..."**)
- The video itself must be your own work (generative AI is not permitted for the video) - see `PRESENTATION_GUIDE.md`.

## Troubleshooting

- `Cannot connect to the database: ECONNREFUSED` -> MySQL is not started; press Start next to MySQL in the XAMPP Control Panel.
- `ER_BAD_DB_ERROR` / `ER_NO_SUCH_TABLE` -> the database was not created; run `database/oceanbloom.sql` in phpMyAdmin.
- `ER_ACCESS_DENIED_ERROR` -> wrong `DB_USER` / `DB_PASSWORD` in `.env`.
- `npm ... running scripts is disabled` -> use `npm.cmd` instead of `npm`.
- `could not read package.json` -> your terminal is in the wrong folder; run `dir` and `cd` into the folder that contains `package.json`.
- `'node' is not recognized` -> Node is not installed, or VS Code was not restarted after installing.
- `EADDRINUSE` (port already in use) -> an old server is still running; press Ctrl+C in that terminal, or close and reopen VS Code.
- Page will not open in Chrome -> the server is not running (look for the "running" line), or you used `https://` or port 5500 (Live Server). Use `http://localhost:3000`.
- The Feeding time challenge will not load -> check your internet; the terminal prints the reason.
- Email not arriving -> read the terminal. With Mailpit: make sure `npm.cmd run mailpit` is running and look at http://localhost:8025. With Brevo: an HTTP 401 means the API key is wrong; otherwise check the spam folder.

## Evidence of testing (add your own screenshots)

1. `npm.cmd test` -> all checks pass.
2. Open http://localhost:3000/game.html without logging in -> you are sent to the login page.
3. Register -> weak passwords are refused with a live checklist; a 6-digit code arrives (Mailpit: http://localhost:8025); entering it creates the account, sends the welcome email, shows "Registration successful" and returns to the login form (username filled in).
3b. Wrong code -> "tries left" message; 5 wrong codes or an expired code -> back to the form.
4. Try registering the same username or email again -> clear error message.
5. Wrong password -> same generic error; five wrong attempts -> temporary lock-out.
6. Pass a level -> the fish grows, changes colour, and new creatures appear.
7. Wrong answer / timeout -> correct answer shown, fish shakes, back to question 1 of the level.
8. Dashboard shows your level, best score and rank; Leaderboard shows all players.
9. Turn off Wi-Fi during a Feeding time challenge -> friendly error and "Try again" button.
