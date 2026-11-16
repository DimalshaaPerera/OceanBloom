# Your solo presentation guide (max 10 minutes)

## Read this first: the video must be YOUR work

Your brief says generative AI is **permitted for code but not for the video**, and the video must be **authentic, in your own voice, with little editing**. So this guide does **not** give you sentences to read out. For each theme it gives you:

- **Where to look** in your code (so you can show it on screen),
- **Questions to answer in your own words** (if you can answer them, you understand it),
- **Alternatives to think about** (this is what moves a mark from 60s to 70%+).

Write your own short bullet notes from it. Do not read a script word for word, and do not paste AI-written text into a transcript. Practise out loud 2-3 times.

Marks come from four rows of the rubric. The top band (70%+) for each row is: **critically discuss / justify your choices while considering alternatives**.

---

## Timeline (aim for about 9 minutes)

| Time | What | Why |
| --- | --- | --- |
| 0:00 - 1:00 | **Short demo of the working game** (required to come first) | Starts the video the way the brief asks |
| 1:00 - 3:00 | Theme 1: low coupling and high cohesion | Rubric row 1 |
| 3:00 - 5:00 | Theme 2: event-driven programming | Rubric row 2 |
| 5:00 - 7:00 | Theme 3: interoperability | Rubric row 3 |
| 7:00 - 9:00 | Theme 4: virtual identity | Rubric row 4 |
| 9:00 - 9:45 | Compare the four themes and say what you would improve | The brief asks you to "compare and reflect" |

## Demo checklist (about 60 seconds, practise it)

1. Open the login page. Point out the reef behind it and move the mouse so the fish follows.
2. Register (or log in) and say the welcome email goes out.
3. Play level 1: small fish, dark empty ocean, countdown bar.
4. Answer correctly: the fish jumps. Pass a level: the fish grows, the colours and creatures appear, the banner shows the level name.
5. Answer wrongly: the fish shakes, you are "stuck" and go back to question 1 of the level.
6. Show the Dashboard and the Leaderboard.

Tip: to avoid wasting demo time, rehearse so you know the easy answers. If your internet is slow, the fish-counting picture may take a moment: say so calmly rather than panic.

---

## Theme 1: Software design - low coupling and high cohesion (about 2 min)

**Where to look**
- The folder listing (README table), then `public/js/game.js`, `ocean.js`, `creatures.js`, `questions.js`, `timer.js`, `backend.js`, and `main.js`.
- On the server: `server/security.js`, `store.js`, `mailer.js`, `config.js`, `server.js`.
- `tests/game.test.js` (run `npm test` on camera).

**Questions to answer in your own words**
- What is the *one job* of `game.js`? Of `creatures.js`? Of `store.js`? (That is cohesion.)
- Which files never mention each other? Why does `game.js` not know the canvas exists? (That is coupling.)
- Which single file knows about everything, and why is that a good idea? (`main.js`.)
- What would you have to change if you replaced the canvas with something else? Or the JSON file with a real database?
- How did low coupling help you test? (The tests run the rules with no browser at all.)

**Alternatives to discuss (70%+)**
- One big script (simple at first, but every change risks breaking something else).
- A framework such as React or Express (more structure, but more to learn and more code you did not write).
- A known pattern: how is your structure like MVC (model / view / controller)?
- Be honest about weaknesses: is anything still too tightly connected?

## Theme 2: Event-driven programming (about 2 min)

**Where to look**
- `public/js/events.js` (the whole file is tiny: `on` and `emit`).
- `public/js/ui.js` (turns browser clicks into your own events), `timer.js` (`timer:tick`, `timer:expired`), `game.js` (what it emits), `main.js` (the list of `bus.on(...)` lines), `ocean.js` (`mousemove` listener, `cheer`, `oops`).

**Questions to answer in your own words**
- What is an event? Who **generates** it and who **handles** it? Give three examples from your game.
- Follow one click end to end: you click an answer -> which event -> who handles it -> what is the next event -> what changes on screen? (Try the correct answer and the wrong answer.)
- Why does the timer emit `timer:expired` instead of ending the game itself?
- What is *asynchronous* about your game? (waiting for the server, `setTimeout` for the pause before the next question, the animation loop).
- Why do the fish's jump and shake use events from the game rules, rather than the game rules calling the canvas directly?

**Alternatives to discuss (70%+)**
- Calling functions directly (easy to read, but everything becomes tightly coupled).
- Checking the clock in a loop ("polling", wasteful) instead of timer events.
- Mention the downside of events: harder to follow the flow when you read the code.

## Theme 3: Interoperability (about 2 min)

**Where to look**
- `server/server.js`: the `fish` function (search for `/api/fish`) and the `mailer.js` file.
- `public/js/api.js` and `backend.js` (the browser's side).
- The Fish Game documentation page, and the JSON it returns.

**Questions to answer in your own words**
- Name every pair of systems that talk to each other (browser, your server, the Fish Game service, the Brevo email API). For each pair: which **protocol** and which **data format**? (Browser <-> your server; your server <-> the Fish Game service; your server <-> the Brevo email API: HTTPS POST with JSON and an API key.)
- The Fish Game service is someone else's code on another computer. What did you have to assume about it, and how do you protect your game if it is slow, down, or sends something unexpected? (Look for the timeout and the shape check.)
- Why does your *server* call the Fish Game service instead of the browser doing it directly?
- Why does your *server* send the email instead of the browser?
- The Fish Game service only supplies a picture and the number of fish. Which part of the "Shark attack" question (the shark eating 1 to 3 fish, so the answer is how many are left) is YOUR logic, and where in the code does it happen (`game.js` `sharkAttack`, called from `main.js`)? Why is it good that you add your own rules on top of someone else's service?
- Your own quiz questions are a local list, not a web service. Why?

**Alternatives to discuss (70%+)**
- The browser calling the service directly (simpler, but cross-origin restrictions and nothing checks the data).
- Sending by SMTP (a mail-server protocol, e.g. Gmail with nodemailer) instead of a REST API: which is simpler to set up, and which is easier to swap for another provider?
- Calling an email API straight from the browser, e.g. EmailJS (no server needed, but the keys end up visible to everyone).
- A trivia web service for the questions (more interoperability, but no ocean category).
- A weakness worth admitting: the correct fish count travels to the browser, so a determined player could look it up. How could a server check answers instead?

## Theme 4: Virtual identity (about 2 min)

**Where to look**
- `server/security.js` (hashing, sessions, cookie, lock-out), the `register` / `login` functions in `server.js`, `public/js/loginPage.js`, `nav.js` (the login check), and the cookie in your browser (F12 -> Application -> Cookies).

**Questions to answer in your own words**
- What is a virtual identity, and how does your game create one? What is **authentication**, and what is **authorization**? (Which pages need a login?)
- What happens to the password when someone registers? Why a **salt**? Why a slow hash (scrypt) rather than a fast one?
- What is stored in the **cookie**, and what is stored on the server? What do `HttpOnly` and `SameSite=Strict` protect against?
- What happens after 5 wrong passwords? Why does the login give the same message for "wrong username" and "wrong password"?
- Where does your server refuse to trust the browser? (e.g. the progress/score check.) Why does that matter for the leaderboard?

**Alternatives to discuss (70%+)**
- Storing everything in the browser (my first version): why is it unsafe for real use?
- Signing in with Google/GitHub (OAuth), JSON Web Tokens, multi-factor authentication.
- What is still missing for a real website? (HTTPS and the `Secure` cookie flag, a real database, sessions that survive a restart, email verification, password reset.)

## Wrap-up (about 45 seconds)

Say in your own words how the four themes connect. Ideas to think about:
- Events and low coupling work together: the event bus is what keeps the parts independent.
- Interoperability and identity are both about **trust at a boundary**: you check data coming from other systems, and you check who the user is.
- One thing you would improve next.

---

## Likely questions from your tutor (practise answers out loud)

1. Which parts did you write and which did an AI or example code provide? (Be specific and honest. Know what you changed.)
2. Show me an event being emitted and handled.
3. Why is this function in this file and not that one?
4. What happens if the Fish Game service is down?
5. Why can the leaderboard not be cheated from the browser?
6. How would you add a new level? A new creature? (Add an entry in `game.js` CONFIG; add a draw function and a `level >= 7` check in `ocean.js` - this shows the structure works.)

## Do before you present (Week 8 or earlier!)

- [ ] **Show the game to your tutor** in or before Week 8 and keep proof (a photo, an email, a note). Without it your mark is capped at 58.
- [ ] Edit the "Code origin" comment at the top of each file to say honestly **what you changed or wrote yourself**.
- [ ] Add a few of your **own questions** to `public/js/questions.js` and say so in the file header.
- [ ] Run `npm test` and screenshot the output (evidence of testing).

## Submission checklist (the grade is capped if you miss these)

- [ ] Source code submitted as its **own zip file** (not only shown in the video). **Delete `.env`, `data` and `node_modules` first.**
- [ ] The video is in **your own voice**, starts with a demo, and uses the terms: low coupling, high cohesion, event-driven, event handler, interoperability, protocol, virtual identity, authentication, password hashing, cookie, session.
- [ ] Code that came from AI or other sources is referenced in the code comments.
- [ ] The code uses the Fish Game API.
- [ ] The video is **10 minutes or less**.
- [ ] Uploaded on BREO **before 10 a.m. on 4 December 2026**.
