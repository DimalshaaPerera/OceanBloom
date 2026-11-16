/*
 * main.js - THE GAME PAGE CONTROLLER (wires everything together)
 * --------------------------------------------------------------
 * Creates the components and connects them by subscribing to events.
 *
 *   UI / Timer --events-->  main.js  --calls-->  GameRules / FishApi / QuestionBank / Backend
 *   GameRules  --events-->  main.js  --calls-->  UI / Ocean / Backend
 *
 * The components (ui, game, ocean, api, timer, questions) never call each other
 * directly. This is the only game file that knows about all of them.
 *
 * Whenever the player passes a level, or finishes the game, the result is sent to
 * the server (Backend.reportProgress) so the dashboard and leaderboard can show it.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
(async function () {
  const profile = await Nav.init('game');   // also checks the player is logged in
  if (!profile) { return; }

  const bus = EventBus;
  const game = GameRules.create(bus);
  const CORRECT_DELAY_MS = 1500;
  const WRONG_DELAY_MS = 3500;     // long enough to read the correct answer

  let nextTimer = null;
  let requestId = 0;       // lets us ignore answers from the web service that arrive too late
  let spec = null;         // what the current question needs: { type, difficulty, timeLimit }
  let question = null;     // the current question: { type: 'choice' | 'fish', ... }
  let startBest = profile.stats.bestScore;   // best score before this run, to detect a new record
  let paused = false;
  let nextWaiting = false; // the next question was due while paused: show it on resume

  UI.init(bus);
  Timer.init(bus);
  Ocean.init(document.getElementById('ocean'));
  let lastTick = -1;            // last whole second we ticked for (countdown sound)

  /* ---------- starting and loading questions ---------- */

  function startGame() {
    clearTimeout(nextTimer);
    Timer.stop();
    paused = false;
    nextWaiting = false;
    Ocean.paused = false;
    UI.setPaused(false);
    requestId++;
    game.reset();
    Ocean.setLevel(1, true);
    Ocean.setUrgency(0);
    Sound.setMood(1);
    UI.showFeedback('', '');
    UI.showPlaying();
    loadQuestion();
  }

  function loadQuestion() {
    spec = game.nextSpec();
    const myRequest = ++requestId;
    UI.showLoading();

    if (spec.type === 'choice') {
      // Ocean quiz question from our own bank.
      question = QuestionBank.next(spec.difficulty);
      game.setQuestion(question.answerIndex);
      UI.showChoiceQuestion(question);
    } else {
      // INTEROPERABILITY: ask (via our server) the Fish Game service for a picture.
      FishApi.fetchQuestion()
        .then(function (q) {
          if (myRequest !== requestId) { return; }          // outdated, ignore
          // OUR rule (in game.js): a shark eats 1-3 of the fish - how many are left?
          const attack = GameRules.sharkAttack(q.answer);
          question = { type: 'fish', answer: attack.left };
          game.setQuestion(attack.left);
          UI.showFishQuestion(q.imageUrl, attack.eaten);
          Ocean.sharkPass();                                 // the shark swims through the reef
          Sound.play('shark');
        })
        .catch(function (error) {
          if (myRequest !== requestId) { return; }
          UI.showError(error.message + ' Press "Try again".');
        });
    }
  }

  function scheduleNextQuestion(delay) {
    if (game.getState().active) {
      nextTimer = setTimeout(function () {
        if (paused) { nextWaiting = true; return; }   // wait until the player resumes
        UI.showFeedback('', '');
        loadQuestion();
      }, delay);
    }
  }

  /* ---------- pause ---------- */

  // Pausing stops the countdown, freezes the ocean and hides the question.
  function setPaused(on) {
    if (on === paused) { return; }
    if (on && !game.getState().active) { return; }   // nothing to pause once the game is over
    paused = on;
    Ocean.paused = on;
    if (on) {
      Timer.pause();
    } else {
      Timer.resume();
      if (nextWaiting) {
        nextWaiting = false;
        UI.showFeedback('', '');
        loadQuestion();
      }
    }
    UI.setPaused(on);
  }

  function report(s, finished) {
    return Backend.reportProgress({ level: s.level, score: s.score, mistakes: s.mistakes, finished: finished });
  }

  /* ---------- events coming from the screen ---------- */

  bus.on('ui:submitAnswer', function (d) {
    if (paused) { return; }              // no answering while the question is hidden
    game.submit(d.value, Timer.remaining());
  });
  bus.on('ui:retry', loadQuestion);
  bus.on('ui:restart', startGame);
  bus.on('ui:togglePause', function () { setPaused(!paused); });
  bus.on('ui:autoPause', function () { setPaused(true); });
  bus.on('ui:questionShown', function () {
    lastTick = -1;
    Timer.start(spec.timeLimit);
    if (paused) { Timer.pause(); return; }   // a picture finished loading while paused
    Sound.play('question');
  });

  /* ---------- events coming from the timer ---------- */

  bus.on('timer:tick', function (t) {
    UI.updateTimer(t);
    // last 5 seconds: a tick every second and the ocean edges pulse red
    const secs = Math.ceil(t.remaining);
    Ocean.setUrgency(t.remaining > 0 && t.remaining <= 5 ? 1 - t.remaining / 5 * 0.6 : 0);
    if (secs <= 5 && secs > 0 && secs !== lastTick) {
      lastTick = secs;
      Sound.play('tick');
    }
  });
  bus.on('timer:expired', function () { Sound.play('timeout'); game.timeout(); });

  /* ---------- events coming from the game rules ---------- */

  bus.on('state:changed', function (s) { UI.updateHud(s); });
  bus.on('answer:invalid', function () { UI.showFeedback('Please type a whole number (0 or more).', 'bad'); });

  bus.on('answer:submitted', function () {
    Timer.stop();
    Ocean.setUrgency(0);
    UI.setAnswerEnabled(false);
  });

  bus.on('answer:correct', function () {
    UI.showFeedback('Correct! Well done.', 'ok');
    Sound.play('correct');
    Ocean.cheer();                      // the fish jumps for joy
    scheduleNextQuestion(CORRECT_DELAY_MS);
  });

  bus.on('answer:wrong', function (s) {
    const shown = question.type === 'fish' ? s.correctAnswer : question.options[s.correctAnswer];
    const why = s.reason === 'time' ? 'Time is up! ' : 'Not quite. ';
    UI.showFeedback(why + 'The answer was: ' + shown + '. You are stuck on level ' + s.level +
      ' - answer all ' + s.stepsPerLevel + ' questions correctly in a row to move on.', 'bad');
    if (question.type === 'choice') { UI.highlightChoice(s.correctAnswer); }
    Ocean.oops();                       // the fish shakes and the screen flashes red
    if (s.reason !== 'time') { Sound.play('wrong'); }   // a time-out already played its own alarm
    scheduleNextQuestion(WRONG_DELAY_MS);
  });

  bus.on('level:up', function (s) {
    Ocean.setLevel(s.level);            // fish grows, ocean gets prettier
    Sound.play('levelUp');
    Sound.setMood(s.level);             // the music gets brighter too
    Ocean.banner('Level ' + s.level + ': ' + s.levelName);
    UI.showFeedback('Level ' + s.level + '! Your fish grew and the ocean is blooming.', 'ok');
    report(s, false).catch(function () { /* saving can wait until the next level */ });
  });

  bus.on('game:won', function (s) {
    Ocean.celebrate();
    Sound.play('win');
    report(s, true)
      .then(function (result) {
        const info = { best: result.bestScore, record: s.score > startBest, rank: result.rank, failed: false };
        startBest = result.bestScore;
        return info;
      })
      .catch(function () {
        return { best: Math.max(startBest, s.score), record: false, rank: null, failed: true };
      })
      .then(function (info) {
        setTimeout(function () {
          UI.showEnd(s.score, info.best, info.record, s.mistakes, info.rank, info.failed);
        }, 2500);
      });
  });

  startGame();
})();
