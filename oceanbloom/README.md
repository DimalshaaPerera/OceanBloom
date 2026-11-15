# OceanBloom 🐠

**CIS045-3 Distributed Service Architectures, Assignment 1 (coursework, 60%)**
A browser game built on the **Fish Game API** by Marc Conrad, written in JavaScript (Node.js server, plain browser code) with a MySQL database.

You start as a small fish in an empty, dark ocean. Answer ocean questions against the clock: each level you pass makes the fish **bigger and changes its look**, and the ocean fills with **colour, creatures and life**. Every level ends with a **Fish Game API** challenge: a hungry shark eats some fish, and you work out how many are left.

| | |
| --- | --- |
| Language / platform | JavaScript: Node.js 18+ (server), HTML5 / CSS / Canvas 2D (browser) |
| Database | MySQL / MariaDB (XAMPP) |
| Third-party services | Fish Game API (game data), Mailpit or Brevo (email) |
| External library | `mysql2` (database driver), the only npm dependency |
| Repository | https://github.com/DimalshaaPerera/OceanBloom |

---

## Contents

1. [How this project meets the brief](#1-how-this-project-meets-the-brief)
2. [Quick start](#2-quick-start-windows--xampp)
3. [How to play](#3-how-to-play)
4. [Architecture overview](#4-architecture-overview)
5. [Theme 1: Low coupling and high cohesion](#5-theme-1-software-design-principles-low-coupling-and-high-cohesion)
6. [Theme 2: Event-driven programming](#6-theme-2-event-driven-programming)
7. [Theme 3: Interoperability](#7-theme-3-interoperability)
8. [Theme 4: Virtual identity](#8-theme-4-virtual-identity)
9. [REST API reference](#9-rest-api-reference)
10. [Database](#10-database)
11. [Testing and evidence](#11-testing-and-evidence)
12. [Project structure](#12-project-structure)
13. [References, third-party code and use of generative AI](#13-references-third-party-code-and-use-of-generative-ai)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. How this project meets the brief

| Requirement from the assignment brief | Where it is met |
| --- | --- |
| A game that uses the **Fish Game API** (https://marcconrad.com/uob/fish/doc.php) | The "Feeding time" challenge at the end of every level: [server/server.js](server/server.js) (`GET /api/fish`) and [public/js/api.js](public/js/api.js) |
| Code complex enough for a meaningful video on the four themes | Several separate components, a client/server split, a database, two external web services and a full login system (sections 4 to 8) |
| **Software design principles** (low coupling, high cohesion) | Section 5 |
| **Event-driven programming** | Section 6 |
| **Interoperability** | Section 7 |
| **Virtual identity** (passwords, cookies, authentication) | Section 8 |
| Full source code of a working implementation | This repository |
| Code from others (websites, LLMs) referenced in the source code | A "Code origin" comment at the top of every source file, plus section 13 |
| Evidence of testing / integration of external software | Section 11 (38 automatic checks plus a manual test list) |
| Video (max 10 minutes, own voice, starts with a demo) | Recorded separately by the student. [PRESENTATION_GUIDE.md](PRESENTATION_GUIDE.md) lists *where to look* in the code, not a script. |

---

## 2. Quick start (Windows + XAMPP)

### What you need (install once)

- **Node.js LTS**: https://nodejs.org. Restart VS Code after installing it.
- **XAMPP**: provides MySQL/MariaDB and phpMyAdmin.
- **Mailpit** (optional, a local test inbox): download `mailpit-windows-amd64.zip` from https://github.com/axllent/mailpit/releases and put `mailpit.exe` in `tools/mailpit/`.

Use `npm.cmd` rather than `npm` in PowerShell. This avoids the "running scripts is disabled" error.

### One-time setup

```powershell
cd C:\xampp\htdocs\oceanbloom\oceanbloom   # the folder that contains package.json
npm.cmd install                            # downloads mysql2
copy .env.example .env                     # settings file (never commit it)
```

1. Open the **XAMPP Control Panel** and **Start** MySQL (and Apache, if you want phpMyAdmin).
2. Open http://localhost/phpmyadmin, go to the **SQL** tab, paste the whole of [database/oceanbloom.sql](database/oceanbloom.sql) and click **Go**. Running it again **wipes all data**.
3. The `DB_...` lines in `.env` already match XAMPP's defaults (user `root`, empty password).

### Every time you run it

| Step | Where | Command / action |
| --- | --- | --- |
| 1 | XAMPP Control Panel | **Start** MySQL |
| 2 | Terminal 1 | `npm.cmd run mailpit`, then leave it running |
| 3 | Terminal 2 | `npm.cmd start` |
| 4 | Browser | Game: **http://localhost:3000**. Inbox: **http://localhost:8025** |

When the server starts correctly, terminal 2 shows:

```
OceanBloom is running at http://localhost:3000
Database: connected to "oceanbloom" on 127.0.0.1:3306 (N players)
Email: ready (sending to Mailpit at http://localhost:8025)
```

To stop a server, press **Ctrl+C** in its terminal. Open the game at `http://localhost:3000`. Apache (`http://localhost/...`) and VS Code's "Go Live" button do not run the Node server. An internet connection is needed for the Fish Game challenge.

### Email options (`EMAIL_PROVIDER` in `.env`)

| Value | What happens |
| --- | --- |
| `mailpit` (default) | Emails go to the local inbox at http://localhost:8025. Nothing reaches real people, so made-up addresses work. |
| `brevo` | Real emails through the Brevo REST API (free plan: 300 a day). Set `BREVO_API_KEY` and a verified `MAIL_FROM_ADDRESS`. |
| empty | Registration still works; the code and the welcome email are printed in the terminal. |

---

## 3. How to play

1. **Register.** Choose a username, email and strong password. A **6-digit code** is emailed to you; enter it and you see "Registration successful", followed by the login form with your username filled in.
2. **Log in.** You land on the **Dashboard** (level, best score, rank, recent games).
3. **Play.** There are 6 levels with 3 questions each:
   - 2 **ocean quiz** questions (multiple choice, from [public/js/questions.js](public/js/questions.js)), then
   - 1 **Feeding time** challenge from the **Fish Game API**: a picture of fish and a treasure chest. A shark will eat 1 to 3 fish, and you type **how many fish are left**.
4. Every question has a **countdown**. Quiz difficulty rises (easy, then medium, then hard) and the time limit gets shorter.
5. You must answer **all 3 questions of a level correctly in a row**. A wrong answer or a time-out means you are **stuck**: you go back to question 1 of that level and lose that attempt's points, plus a 5-point penalty.
6. **Score:** 10 × level for each correct answer, plus 1 point per second left (the maximum possible is 968). Results go to the **Leaderboard**.
7. **Pause:** the **Pause** button (or **P** / **Esc**) stops the clock, freezes the ocean and hides the question, so pausing cannot buy thinking time. Switching tabs pauses the game automatically.

### The ocean blooms as you level up

| Level | Name | The ocean | Your fish |
| --- | --- | --- | --- |
| 1 | Lonely Water | Empty, dark water with drifting specks | Small and orange |
| 2 | Bubble Bay | Sunbeams, bubbles, surface waves, a jellyfish | Bigger, pink with white stripes |
| 3 | Kelp Garden | Hills, sand, rocks, seaweed, a turtle, a crab | Bigger, yellow, glowing |
| 4 | Coral Courtyard | Coral, anemones, starfish, a seahorse, a manta ray | Bigger, purple, a big top fin |
| 5 | Reef Parade | A distant whale, a school of fish, an octopus, a clam with a pearl | Bigger, red |
| 6 | Treasure Lagoon | Open treasure chest, brightest water | Biggest, rainbow colours, golden crown |

The fish follows the mouse. Answer correctly and it jumps with hearts; answer wrongly and it shakes while the screen flashes red. Passing a level brings a banner and confetti, and winning brings fireworks. All sounds and the background music are generated live with the **Web Audio API** ([public/js/sound.js](public/js/sound.js), no audio files). The buttons in the bottom-right corner turn them on and off.

---

## 4. Architecture overview

OceanBloom is a **three-tier, client/server** application that also talks to **two external services**:

```
 ┌───────────────────────── Browser (public/) ─────────────────────────┐
 │  login.html  game.html  dashboard.html  leaderboard.html            │
 │                                                                     │
 │  ui.js ─┐   timer.js ─┐          game.js (rules, no screen code)    │
 │         ▼             ▼              ▲   │                          │
 │      ┌──────── EventBus (events.js): publish / subscribe ───────┐   │
 │      └──────────────────────────▲───────────────────────────────┘   │
 │                                 │                                   │
 │                     main.js (controller, wires it all)              │
 │                      │                  │                           │
 │               backend.js            api.js        ocean.js / sound.js│
 └──────────────────────┼──────────────────┼───────────────────────────┘
            HTTP + JSON │  (session cookie)│ HTTP + JSON
                        ▼                  ▼
 ┌───────────────────── Node.js server (server/) ──────────────────────┐
 │  server.js: REST API + page guard                                   │
 │  security.js (passwords, sessions, cookies)  verification.js (OTP)  │
 │  store.js (all SQL) ──► db.js (connection pool)   mailer.js (email) │
 └──────┬────────────────────────────┬─────────────────────┬───────────┘
        │ SQL (prepared statements)  │ HTTPS GET + JSON    │ HTTP(S) POST + JSON
        ▼                            ▼                     ▼
   MySQL / MariaDB            Fish Game API           Mailpit / Brevo
   (XAMPP)                    (marcconrad.com)        (email services)
```

---

## 5. Theme 1: Software design principles (low coupling and high cohesion)

**High cohesion:** each file has **one job**, stated in the comment at its top.

| Component | Its single responsibility |
| --- | --- |
| [public/js/game.js](public/js/game.js) | Game rules only: levels, scoring, "stuck" logic. It never touches the screen, the timer or the network. |
| [public/js/timer.js](public/js/timer.js) | Counting down (and pausing) only |
| [public/js/ui.js](public/js/ui.js) | Reading and writing the game page's HTML only |
| [public/js/ocean.js](public/js/ocean.js) + [creatures.js](public/js/creatures.js) | Drawing the animated scene only |
| [public/js/api.js](public/js/api.js) | The only browser file that requests Fish Game data |
| [public/js/backend.js](public/js/backend.js) | The only browser file that calls our own `/api/...` |
| [public/js/validation.js](public/js/validation.js) | Username, email, password and code rules, **shared by browser and server** (one source of truth) |
| [server/db.js](server/db.js) | The only file that connects to MySQL |
| [server/store.js](server/store.js) | All SQL queries (data access layer) |
| [server/security.js](server/security.js) | Passwords, sessions, cookies, lock-out |
| [server/mailer.js](server/mailer.js) | Sending email to Mailpit or Brevo |
| [server/config.js](server/config.js) | Reading settings and secrets from `.env` |

**Low coupling:**
- The browser components **never call each other directly**. They communicate through the **EventBus** ([events.js](public/js/events.js)). For example, `game.js` emits `level:up` and does not know that the ocean, the sound and the server all react to it.
- [main.js](public/js/main.js) is the **only** file that knows about all the components (a mediator/controller). Any one component can be replaced without editing the others.
- The rules in `game.js` have no dependency on the DOM, so they can be **unit tested in Node** without a browser ([tests/game.test.js](tests/game.test.js)). This is the practical benefit of low coupling.
- On the server, `server.js` never writes SQL itself; it asks `store.js`. Switching from the old JSON file to MySQL changed `store.js` and `db.js` and left the rest of the code untouched.
- Swapping Mailpit for Brevo is a **configuration change** (`EMAIL_PROVIDER`), not a code change.

**Alternatives that could be discussed:** a framework such as React or Express (more structure, more dependencies); classes or ES modules instead of object literals; calling components directly instead of through events (simpler, but tightly coupled); an ORM instead of hand-written SQL.

---

## 6. Theme 2: Event-driven programming

The program does not run top to bottom. It **waits for events and reacts to them**. There are three layers of events:

**1. Browser (DOM) events.** These are generated by the user or the browser:
- `click` and `submit` on the answer buttons and forms ([ui.js](public/js/ui.js), [loginPage.js](public/js/loginPage.js))
- `input` and `blur` for live form validation (the password checklist updates as you type)
- `mousemove` and `pointerdown` on the canvas (the fish follows the mouse) ([ocean.js](public/js/ocean.js))
- `keydown` (P / Esc to pause) and `visibilitychange` (auto-pause when the tab is hidden)
- `load` and `error` on the Fish Game picture; `requestAnimationFrame` drives the animation loop
- One delegated `click` listener plays a sound for every button ([sound.js](public/js/sound.js))

**2. Our own application events.** These use a **publish/subscribe EventBus** ([events.js](public/js/events.js), with `on()` and `emit()`):

| Event | Published by | Handled in `main.js` by... |
| --- | --- | --- |
| `ui:submitAnswer`, `ui:retry`, `ui:restart`, `ui:togglePause`, `ui:autoPause`, `ui:questionShown` | `ui.js` | Passing answers to the rules, loading questions, pausing |
| `timer:tick`, `timer:expired` | `timer.js` | Updating the countdown bar, tick sounds, the red pulse, the time-out |
| `answer:submitted`, `answer:correct`, `answer:wrong`, `answer:invalid` | `game.js` | Feedback, fish animations, sounds |
| `level:up`, `game:won`, `state:changed` | `game.js` | Growing the fish, the banner and confetti, saving progress to the server |

**3. Server-side events.** Node.js is itself event-driven: `http.createServer` calls a handler for each incoming **request** event, and `fetch` to the Fish Game API is **asynchronous** (`async`/`await`), so the server never blocks while waiting. A `setInterval` cleans up expired sign-ups every 10 minutes.

**Alternatives that could be discussed:** direct callbacks (simpler but more tightly coupled); polling instead of events; a library's event system (e.g. Node's `EventEmitter`); server-pushed events (WebSockets) for a live leaderboard.

---

## 7. Theme 3: Interoperability

OceanBloom works together with code **written by other people, in other languages, running on other systems**. In every case the agreed protocol is **HTTP** and the data format is **JSON**.

| Connection | Protocol and format | Code |
| --- | --- | --- |
| Browser → our server | HTTP `fetch`, JSON body and response, REST endpoints (section 9) | [backend.js](public/js/backend.js), [api.js](public/js/api.js) |
| Our server → **Fish Game API** (third party, PHP, marcconrad.com) | **HTTPS GET**, JSON response `{ "question": "<image URL>", "fish": 2, "chest": 7 }` | `fish()` in [server.js](server/server.js) |
| Browser → Fish Game image host | HTTPS image (PNG) | [ui.js](public/js/ui.js) `showFishQuestion` |
| Our server → **Mailpit** (Go program) | HTTP **POST** `/api/v1/send`, JSON | [mailer.js](server/mailer.js) |
| Our server → **Brevo** (cloud email service) | HTTPS **POST** `/v3/smtp/email`, JSON, `api-key` header | [mailer.js](server/mailer.js) |
| Our server → **MySQL/MariaDB** | MySQL protocol through the `mysql2` driver, SQL with `?` placeholders | [db.js](server/db.js), [store.js](server/store.js) |

**Design decisions:**
- **The server acts as a proxy for the Fish Game API.** The browser calls `/api/fish` on our own server, which then calls the Fish Game service. This avoids browser cross-origin (CORS) problems, keeps the API in one place, and lets us **validate the response** (checking that `question` is a URL and `fish` is a whole number ≥ 0) before trusting it.
- **Defensive integration:** a 10-second timeout (`AbortController`), friendly error messages and a "Try again" button cover the case where the external service is slow or offline.
- **Our own twist on the data:** the API supplies the fish count, and the game subtracts the 1 to 3 fish the shark eats. That turns the third-party data into a new puzzle.

**Alternatives that could be discussed:** calling the API straight from the browser (simpler, but exposed to CORS and unvalidated data); SOAP/XML or GraphQL instead of REST/JSON; SMTP instead of an HTTP email API; caching API responses.

---

## 8. Theme 4: Virtual identity

Virtual identity is how the application knows **who a player is** and keeps that identity safe.

| Mechanism | How it works | Code |
| --- | --- | --- |
| **Registration with email verification** | Step 1 checks the details and emails a **6-digit one-time code** (stored only as a salted hash, valid for 10 minutes, 5 tries, resend after 60 s, at most 5 sends, and a per-IP limit). Step 2 creates the account only if the code matches. | [verification.js](server/verification.js), [loginPage.js](public/js/loginPage.js) |
| **Strong password rules** | 8 to 64 characters, upper and lower case, a number, a symbol, no spaces, must not contain the username, not a common password. The same file checks this in the browser (instant feedback) and on the server (cannot be bypassed). | [validation.js](public/js/validation.js) |
| **Password storage** | Passwords are **never stored**. The server stores a random 16-byte **salt** and the **scrypt** hash. scrypt is deliberately slow, which makes guessing expensive. Hashes are compared with `timingSafeEqual`. | [security.js](server/security.js) |
| **Sessions and cookies** | After login, the server creates a random 32-byte token and sends it in the cookie `oceanbloom_session`. The database stores only its **SHA-256 hash**. The session expires after 2 hours. | [security.js](server/security.js) |
| **Cookie flags** | `HttpOnly` (page JavaScript cannot read it, which limits XSS damage), `SameSite=Strict` (blocks most CSRF), `Path=/`, `Max-Age`. On HTTPS, the `Secure` flag would be added. | [security.js](server/security.js) |
| **Brute-force protection** | 5 wrong passwords (same IP + username) lock the login for 30 seconds. The error message is the same for "no such user" and "wrong password" (and a dummy hash keeps the timing equal), so attackers cannot discover which usernames exist. | [security.js](server/security.js), [server.js](server/server.js) |
| **Authorisation** | `game.html`, `dashboard.html` and `leaderboard.html` are only served to logged-in players (a server-side page guard); the API returns `401` otherwise. | [server.js](server/server.js), [nav.js](public/js/nav.js) |
| **Server-side checks** | Progress reports are validated: the level must be 1 to 6 and the score a whole number no higher than 1000 (the real maximum is 968), so a player cannot post a fake score by calling the API directly. | [server.js](server/server.js) |
| **Secrets** | API keys and the database password live in `.env`, which git ignores. They are never in the code. | [config.js](server/config.js), [.gitignore](.gitignore) |

**Alternatives that could be discussed:** JWT tokens instead of server sessions; bcrypt or Argon2 instead of scrypt; OAuth / "Sign in with Google"; two-factor authentication on every login; magic-link (passwordless) login; HTTPS with the `Secure` flag in production.

---

## 9. REST API reference

All endpoints use JSON. 🔒 = needs the session cookie.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/register/start` | Validate details and email a 6-digit code |
| POST | `/api/register/resend` | Email a new code |
| POST | `/api/register/verify` | Check the code, create the account, send the welcome email |
| POST | `/api/login` | Log in (sets the session cookie) |
| POST | `/api/logout` | Log out (clears the cookie and deletes the session) |
| GET 🔒 | `/api/me` | Current player and their statistics |
| POST 🔒 | `/api/progress` | Save level / score / mistakes |
| GET 🔒 | `/api/leaderboard` | Top players |
| GET 🔒 | `/api/fish` | Proxy to the Fish Game API |

---

## 10. Database

Created by [database/oceanbloom.sql](database/oceanbloom.sql) in a MySQL database called `oceanbloom`. Every query uses **prepared statements** (`?` placeholders), so player input can never run as SQL (no SQL injection).

| Object | What it holds |
| --- | --- |
| `users` | Username, email, password salt + scrypt hash, email-verified flag |
| `player_stats` | Best score, highest level, games completed, total mistakes (created by a **trigger** for each new user) |
| `game_results` | One row per finished game (the dashboard's recent games) |
| `sessions` | SHA-256 hash of each login token, expiry, IP, browser |
| `email_verifications` | Pending sign-ups and the hash of their code |
| `login_attempts` | Failed logins per IP + username, for the lock-out |
| `email_log` | Every email the server tried to send |
| `leaderboard` (**view**) | Players ranked by best score, then highest level |

If you have accounts from the older JSON-file version (`data/users.json`), run `npm.cmd run db:import` once to copy them in.

---

## 11. Testing and evidence

### Automatic tests

```powershell
npm.cmd test
```

This runs **38 checks** in [tests/game.test.js](tests/game.test.js) covering the game rules (scoring, "stuck" logic, levels, the maximum score), the question bank and the credential rules. It needs no browser, which is possible only because `game.js` is decoupled from the screen.

### Manual test checklist (screenshot each one as evidence)

| # | Test | Expected result |
| --- | --- | --- |
| 1 | `npm.cmd test` | "All checks passed." |
| 2 | Open http://localhost:3000/game.html while logged out | Redirected to the login page |
| 3 | Register with a weak password | Refused; the live checklist shows which rules fail |
| 4 | Register properly and open http://localhost:8025 | A 6-digit code email arrives |
| 5 | Enter a wrong code | "That code is not right. N tries left." |
| 6 | Enter the right code | "Registration successful!", then the login form appears and a welcome email arrives |
| 7 | Register the same username or email again | A clear "already taken" message |
| 8 | Log in with a wrong password 5 times | Generic error, then a 30-second lock-out |
| 9 | Pass a level | The fish grows and changes colour, new creatures appear, a banner shows |
| 10 | Answer wrongly / let the time run out | Correct answer shown, fish shakes, back to question 1 of the level |
| 11 | Press Pause (or P) | Clock stops, question hidden, ocean frozen; Resume continues with the same time |
| 12 | Disconnect Wi-Fi during a Feeding time question | Friendly error and a "Try again" button |
| 13 | Dashboard / Leaderboard | Level, best score, rank and all players shown |
| 14 | Browser DevTools → Application → Cookies | `oceanbloom_session` is `HttpOnly` and `SameSite=Strict` |
| 15 | phpMyAdmin → `users` table | Only salts and hashes, never plain-text passwords |

---

## 12. Project structure

```
oceanbloom/
├── package.json            scripts: start, test, mailpit, db:import
├── .env.example            settings template (copy to .env; .env is git-ignored)
├── README.md               this file
├── PRESENTATION_GUIDE.md   where to look in the code for each theme (not a script)
├── database/
│   ├── oceanbloom.sql      tables, keys, trigger, leaderboard view
│   └── import-json.js      one-time import from the old JSON version
├── server/                 Node.js back end
│   ├── server.js           HTTP server, REST API, page guard, Fish Game proxy
│   ├── security.js         scrypt passwords, sessions, cookies, lock-out
│   ├── verification.js     email one-time codes
│   ├── mailer.js           Mailpit / Brevo email
│   ├── store.js            all SQL (data access)
│   ├── db.js               MySQL connection pool
│   └── config.js           reads .env
├── public/                 browser front end
│   ├── login.html  game.html  dashboard.html  leaderboard.html
│   ├── css/style.css
│   └── js/
│       ├── events.js       EventBus (publish/subscribe)
│       ├── main.js         game page controller
│       ├── game.js         game rules (no screen code)
│       ├── timer.js        countdown with pause
│       ├── ui.js           game page HTML
│       ├── ocean.js        animated scene
│       ├── creatures.js    drawing helpers
│       ├── sound.js        Web Audio effects and music
│       ├── questions.js    ocean quiz question bank
│       ├── api.js          Fish Game data (through our server)
│       ├── backend.js      calls to our own REST API
│       ├── validation.js   shared credential rules
│       ├── nav.js          shared menu and login check
│       ├── loginPage.js  dashboardPage.js  leaderboardPage.js
└── tests/
    └── game.test.js        38 automatic checks
```

Not committed (see `.gitignore`): `.env`, `node_modules/`, `data/`, `tools/` (the Mailpit program).

---

## 13. References, third-party code and use of generative AI

### External services and software

- **Fish Game API**, Marc Conrad, University of Bedfordshire: https://marcconrad.com/uob/fish/doc.php (HTTPS GET, JSON)
- **Brevo** transactional email API: https://developers.brevo.com/reference/sendtransacemail
- **Mailpit** (local email testing), Ralph Slooten: https://mailpit.axllent.org. Send API: https://mailpit.axllent.org/docs/api-v1/
- **mysql2** Node.js driver: https://github.com/sidorares/node-mysql2
- **MySQL / MariaDB** via **XAMPP** (Apache Friends): https://www.apachefriends.org
- **Node.js** built-in modules: `http`, `fs`, `path`, `crypto` (scrypt, SHA-256, random tokens), `fetch`
- **Browser APIs:** Fetch, Canvas 2D, Web Audio, `requestAnimationFrame`, `sessionStorage` / `localStorage`
- **Ocean quiz questions** ([public/js/questions.js](public/js/questions.js)): written for this project from general knowledge

### Use of generative AI

As the brief allows, **generative AI was used for the code (but not for the video)**. A first draft of the code was generated with **Claude (Anthropic)** in October–November 2026 from prompts describing the assignment and my game idea, and Claude was later used for fixes and features (for example the email-verification fix and the pause button). I read, ran, tested and modified the code. Every source file has a **"Code origin"** comment at the top, as the brief requires.

**What I changed or wrote myself:**
> *(Student: fill this in honestly before submitting, e.g. "I designed the game idea and the level themes, wrote / checked the quiz questions, changed the colours and timings, tested every feature, ..." The brief requires you to make clear which code is yours.)*

### The video

The video is recorded in my own voice without generative AI, as the brief requires. [PRESENTATION_GUIDE.md](PRESENTATION_GUIDE.md) only lists where each theme can be found in the code.

---

## 14. Troubleshooting

| Problem | Fix |
| --- | --- |
| `ECONNREFUSED` (database) | Start MySQL in the XAMPP Control Panel |
| `ER_BAD_DB_ERROR` / `ER_NO_SUCH_TABLE` | Run [database/oceanbloom.sql](database/oceanbloom.sql) in phpMyAdmin |
| `ER_ACCESS_DENIED_ERROR` | Wrong `DB_USER` / `DB_PASSWORD` in `.env` |
| `running scripts is disabled` | Use `npm.cmd` instead of `npm` |
| `could not read package.json` | Wrong folder: `cd` into the folder that contains `package.json` |
| `'node' is not recognized` | Install Node.js, then restart VS Code |
| `EADDRINUSE` | A server is already running: press Ctrl+C in that terminal |
| Page will not open | Is `npm.cmd start` running? Use `http://localhost:3000`, not `https://`, Apache or port 5500 |
| A button does nothing after an update | Hard refresh with **Ctrl+F5** to load the newest JavaScript |
| Feeding time will not load | Check your internet connection; the terminal prints the reason |
| No email arrives | Is `npm.cmd run mailpit` running? Check http://localhost:8025. With Brevo, HTTP 401 means a wrong API key; also check the spam folder. |
