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

  UI.init(bus);
  Timer.init(bus);
  Ocean.init(document.getElementById('ocean'));

  /* ---------- starting and loading questions ---------- */

  function startGame() {
    clearTimeout(nextTimer);
    Timer.stop();
    requestId++;
    game.reset();
    Ocean.setLevel(1, true);
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
          // The Fish Game API gives us the number of fish; OUR twist is the shrimp sum.
          const shrimp = q.answer * spec.shrimpEach;
          question = { type: 'fish', answer: shrimp };
          game.setQuestion(shrimp);
          UI.showFishQuestion(q.imageUrl, spec.shrimpEach);
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
        UI.showFeedback('', '');
        loadQuestion();
      }, delay);
    }
  }

  function report(s, finished) {
    return Backend.reportProgress({ level: s.level, score: s.score, mistakes: s.mistakes, finished: finished });
  }

  /* ---------- events coming from the screen ---------- */

  bus.on('ui:submitAnswer', function (d) { game.submit(d.value, Timer.remaining()); });
  bus.on('ui:retry', loadQuestion);
  bus.on('ui:restart', startGame);
  bus.on('ui:questionShown', function () { Timer.start(spec.timeLimit); });

  /* ---------- events coming from the timer ---------- */

  bus.on('timer:tick', function (t) { UI.updateTimer(t); });
  bus.on('timer:expired', function () { game.timeout(); });

  /* ---------- events coming from the game rules ---------- */

  bus.on('state:changed', function (s) { UI.updateHud(s); });
  bus.on('answer:invalid', function () { UI.showFeedback('Please type a whole number (0 or more).', 'bad'); });

  bus.on('answer:submitted', function () {
    Timer.stop();
    UI.setAnswerEnabled(false);
  });

  bus.on('answer:correct', function () {
    UI.showFeedback('Correct! Well done.', 'ok');
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
    scheduleNextQuestion(WRONG_DELAY_MS);
  });

  bus.on('level:up', function (s) {
    Ocean.setLevel(s.level);            // fish grows, ocean gets prettier
    Ocean.banner('Level ' + s.level + ': ' + s.levelName);
    UI.showFeedback('Level ' + s.level + '! Your fish grew and the ocean is blooming.', 'ok');
    report(s, false).catch(function () { /* saving can wait until the next level */ });
  });

  bus.on('game:won', function (s) {
    Ocean.celebrate();
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
