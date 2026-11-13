/*
 * game.js - GAME RULES (pure logic)
 * ---------------------------------
 * HIGH COHESION: this file has ONE job - the rules of the game. It does not touch
 * the screen, the canvas, the timer, the server or the web service.
 * LOW COUPLING: it talks to the rest of the program only by emitting events:
 *   answer:invalid, answer:submitted, answer:correct, answer:wrong,
 *   level:up, game:won, state:changed
 *
 * THE RULES
 *  - There are 6 levels. Each level has 3 questions: 2 ocean quiz questions and
 *    then 1 "Feeding time" challenge (count the fish in a picture from the Fish Game API, then work out how much shrimp they need).
 *  - Levels get harder: quiz difficulty goes easy -> medium -> hard and the time
 *    limit gets shorter.
 *  - You must answer ALL 3 questions of a level correctly IN A ROW.
 *  - A wrong answer (or running out of time) means you are STUCK: you go back to
 *    the start of the current level, you lose the points you earned in that level
 *    attempt, and you lose 5 more. You cannot move forward until you pass the level.
 *  - Each correct answer scores 10 x level points, plus 1 point per second left.
 *    The best possible total is 968 (the server uses this to reject fake scores).
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const GameRules = {
  CONFIG: {
    totalLevels: 6,
    stepsPerLevel: 3,       // 2 quiz questions + 1 'Feeding time' question
    pointsPerLevel: 10,
    wrongPenalty: 5,
    levels: [               // name, difficulty and seconds allowed, per level
      // shrimpEach = shrimp every fish eats in the "Feeding time" challenge (more = harder sum)
      { name: 'Lonely Water',     difficulty: 'easy',   quizTime: 20, fishTime: 30, shrimpEach: 1 },
      { name: 'Bubble Bay',       difficulty: 'easy',   quizTime: 15, fishTime: 30, shrimpEach: 1 },
      { name: 'Kelp Garden',      difficulty: 'medium', quizTime: 18, fishTime: 30, shrimpEach: 2 },
      { name: 'Coral Courtyard',  difficulty: 'medium', quizTime: 14, fishTime: 30, shrimpEach: 2 },
      { name: 'Reef Parade',      difficulty: 'hard',   quizTime: 15, fishTime: 30, shrimpEach: 3 },
      { name: 'Treasure Lagoon',  difficulty: 'hard',   quizTime: 12, fishTime: 30, shrimpEach: 3 }
    ]
  },

  create(bus) {
    const config = this.CONFIG;
    let state = null;
    let currentAnswer = null;   // the correct answer for the question on screen

    function snapshot() {
      return {
        level: state.level,
        levelName: config.levels[state.level - 1].name,
        step: state.step,
        score: state.score,
        mistakes: state.mistakes,
        active: state.active,
        totalLevels: config.totalLevels,
        stepsPerLevel: config.stepsPerLevel
      };
    }

    function reset() {
      state = { level: 1, step: 0, score: 0, levelStartScore: 0, mistakes: 0, active: true };
      currentAnswer = null;
      bus.emit('state:changed', snapshot());
    }

    // What kind of question comes next, how hard, and how many seconds?
    function nextSpec() {
      const lv = config.levels[state.level - 1];
      const isFish = state.step === config.stepsPerLevel - 1;
      return {
        type: isFish ? 'fish' : 'choice',
        difficulty: lv.difficulty,
        timeLimit: isFish ? lv.fishTime : lv.quizTime,
        shrimpEach: lv.shrimpEach
      };
    }

    // Called when a new question is on screen. For a multiple-choice question
    // the answer is the position (0-3) of the right option; for the fish
    // question it is the number of fish.
    function setQuestion(answer) {
      currentAnswer = answer;
    }

    function onCorrect(secondsLeft) {
      state.score += config.pointsPerLevel * state.level + Math.floor(secondsLeft);
      state.step++;

      let leveledUp = false;
      let won = false;
      if (state.step >= config.stepsPerLevel) {
        state.step = 0;
        leveledUp = true;
        state.levelStartScore = state.score;          // points are "banked" when a level is passed
        if (state.level >= config.totalLevels) {
          won = true;
          state.active = false;
        } else {
          state.level++;
        }
      }

      // The state is fully updated BEFORE any event is sent out.
      bus.emit('state:changed', snapshot());
      bus.emit('answer:correct', snapshot());
      if (leveledUp && !won) { bus.emit('level:up', snapshot()); }
      if (won) { bus.emit('game:won', snapshot()); }
    }

    function onWrong(correctAnswer, reason) {
      state.step = 0;                                   // stuck: back to the start of this level
      state.mistakes++;
      state.levelStartScore = Math.max(0, state.levelStartScore - config.wrongPenalty);
      state.score = state.levelStartScore;              // unbanked points of this attempt are lost

      bus.emit('state:changed', snapshot());
      const data = snapshot();
      data.correctAnswer = correctAnswer;
      data.reason = reason;                             // 'wrong' or 'time'
      bus.emit('answer:wrong', data);
    }

    // The player chose an answer. secondsLeft is used for the speed bonus.
    function submit(rawValue, secondsLeft) {
      if (!state || !state.active || currentAnswer === null) { return; }

      const text = String(rawValue).trim();
      const guess = Number(text);
      if (text === '' || !Number.isInteger(guess) || guess < 0) {
        bus.emit('answer:invalid');
        return;
      }

      const correctAnswer = currentAnswer;
      currentAnswer = null;   // lock: one answer per question
      bus.emit('answer:submitted', { guess: guess });

      if (guess === correctAnswer) {
        onCorrect(secondsLeft || 0);
      } else {
        onWrong(correctAnswer, 'wrong');
      }
    }

    // The time ran out before an answer was given.
    function timeout() {
      if (!state || !state.active || currentAnswer === null) { return; }
      const correctAnswer = currentAnswer;
      currentAnswer = null;
      bus.emit('answer:submitted', { guess: null });
      onWrong(correctAnswer, 'time');
    }

    return {
      reset: reset,
      nextSpec: nextSpec,
      setQuestion: setQuestion,
      submit: submit,
      timeout: timeout,
      getState: function () { return state ? snapshot() : null; }
    };
  }
};
