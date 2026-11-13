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
| 1 | Lonely Water | Empty, dark water | Small orange fish (it blows a bubble now and then) |
| 2 | Bubble Bay | Sunbeams, bubbles, glowing dust, surface waves, a jellyfish | Bigger, pink, white stripes |
| 3 | Kelp Garden | Hills, sandy floor, swaying seaweed, a sea turtle | Bigger, yellow |
| 4 | Coral Courtyard | Coral, starfish, a seahorse | Bigger, purple, a big top fin |
| 5 | Reef Parade | A whale far away, a school of little fish, a second jellyfish | Bigger, red |
| 6 | Treasure Lagoon | Open treasure chest, brightest water | Biggest, rainbow colours, golden crown, sparkle trail |

Extras: move the mouse over the ocean and **the fish swims after it**. A correct answer makes the fish **jump with hearts**; a wrong answer makes it **shake and the screen flashes red**; passing a level shows a **banner and confetti**; winning makes **confetti rain**. The login page shows the finished reef behind the form.

## Quick start (Windows, step by step)

You need **Node.js** (a program that runs the game's server).

1. Download and install the **LTS** version from https://nodejs.org (accept the defaults). Then **close and reopen VS Code**.
2. Unzip `oceanbloom.zip`. In VS Code choose **File -> Open Folder** and pick the folder that **directly contains `package.json`** (there may be two folders with the same name - open the inner one).
3. Open a terminal: **Terminal -> New Terminal**. Type `dir` - you must see `package.json`, `server` and `public`.
4. Install (only needed once; this game has no add-on libraries, so it finishes instantly): `npm.cmd install`
5. Start the game: `npm.cmd start` - you should see `OceanBloom is running at http://localhost:3000`.
6. Open **http://localhost:3000** in Chrome or Edge (type `http://`, not `https://`).
7. To stop the server later, click in the terminal and press **Ctrl+C**.

(`npm.cmd` instead of `npm` avoids a common PowerShell error "running scripts is disabled". On Mac/Linux just use `npm`.)

The server must be running whenever you play. If you change a file, stop the server (Ctrl+C), run `npm.cmd start` again and refresh the browser. Do not use the "Go Live" button - this version needs its own server.

You need an internet connection for the Feeding time challenge (Fish Game service) and for real emails.

## Automatic tests

`npm.cmd test` runs 22 checks on the game rules and the question bank (no browser needed). Screenshot the result as evidence of testing.

## The welcome email (Brevo email API)

Until you set it up, registration still works and the email is simply **printed in the terminal**. To send real emails through the Brevo web API (free plan, 300 emails a day):

1. Create a free account at https://www.brevo.com
2. Add your own email address as a **sender** (Senders, Domains & Dedicated IPs -> Senders) and click the verification link Brevo emails you.
3. Create an **API key** (top-right menu -> SMTP & API -> API Keys -> Generate a new API key). Copy it.
4. In VS Code, copy `.env.example`, paste it, and rename the copy to exactly `.env` (same folder as `package.json`).
5. Open `.env` and fill in `BREVO_API_KEY` (the key) and `MAIL_FROM_ADDRESS` (the sender you verified). Leave the other lines as they are.
6. Stop the server (Ctrl+C) and run `npm.cmd start` again. It should now say `Email: ready`.
7. Register a new account with a real email address you can open. Check the inbox and the **spam folder**.

**Never share `.env` or put it in your submission** - it contains your API key.

## Where the data is

Accounts and statistics are saved in `data/users.json`, created automatically. Delete that file to reset everything. Logins (sessions) are kept in the server's memory, so after you restart the server you simply log in again.

## Project structure

| File | Single responsibility | Assignment theme |
| --- | --- | --- |
| `server/server.js` | Web server and REST API (`/api/...`), page guard | Interoperability, identity |
| `server/security.js` | Password hashing (scrypt), sessions, HttpOnly cookie, lock-out | Virtual identity |
| `server/mailer.js` | Sends the welcome email through the Brevo REST API (fetch + JSON) | Interoperability |
| `server/store.js` | Saves users and statistics (JSON file) | High cohesion |
| `server/config.js` | Reads settings and secrets from `.env` | High cohesion |
| `public/login.html` + `js/loginPage.js` | Login / register page | Event-driven programming |
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
- Node.js built-in modules: `http`, `fs`, `path`, `crypto` (scrypt, random tokens).
- Browser built-ins: `fetch`, Canvas 2D, CSS animations.
- Ocean quiz questions: a local bank (`public/js/questions.js`) written for this project from general knowledge. **Student: check the answers yourself and add a few of your own.**
- **Generative AI:** the first draft of the code (including the animated scene) was generated with Claude (Anthropic) in October-November 2026 from prompts describing the assignment and my game idea. I then read, ran and modified it. (**Student: list here exactly what you changed or wrote yourself, e.g. "I added questions, changed the colours and timings, ..."**)
- The video itself must be your own work (generative AI is not permitted for the video) - see `PRESENTATION_GUIDE.md`.

## Troubleshooting

- `npm ... running scripts is disabled` -> use `npm.cmd` instead of `npm`.
- `could not read package.json` -> your terminal is in the wrong folder; run `dir` and `cd` into the folder that contains `package.json`.
- `'node' is not recognized` -> Node is not installed, or VS Code was not restarted after installing.
- `EADDRINUSE` (port already in use) -> an old server is still running; press Ctrl+C in that terminal, or close and reopen VS Code.
- Page will not open in Chrome -> the server is not running (look for the "running" line), or you used `https://` or port 5500 (Live Server). Use `http://localhost:3000`.
- The Feeding time challenge will not load -> check your internet; the terminal prints the reason.
- Email not arriving -> read the terminal: an authentication error means the app password is wrong; otherwise check the spam folder.

## Evidence of testing (add your own screenshots)

1. `npm.cmd test` -> all checks pass.
2. Open http://localhost:3000/game.html without logging in -> you are sent to the login page.
3. Register with a real email -> welcome email arrives (or is printed in the terminal).
4. Try registering the same username or email again -> clear error message.
5. Wrong password -> same generic error; five wrong attempts -> temporary lock-out.
6. Pass a level -> the fish grows, changes colour, and new creatures appear.
7. Wrong answer / timeout -> correct answer shown, fish shakes, back to question 1 of the level.
8. Dashboard shows your level, best score and rank; Leaderboard shows all players.
9. Turn off Wi-Fi during a Feeding time challenge -> friendly error and "Try again" button.
