/*
 * game.test.js - AUTOMATIC TESTS (run with: npm test)
 * ---------------------------------------------------
 * These tests check the game rules and the question bank WITHOUT a browser.
 * That is possible because game.js has no screen code in it (LOW COUPLING):
 * it only talks by sending events, so a test can listen to those events instead
 * of looking at a web page.
 *
 * Each check prints PASS or FAIL. If anything fails, the script ends with an error.
 * Screenshot the output as "evidence of testing" for your submission.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load browser files into an empty sandbox. There is no `document` or `window` in
// it, so if game.js tried to touch the screen, loading it would crash.
function load(files, names) {
  const sandbox = vm.createContext({ console: console, Math: Math });
  const code = files.map(function (f) {
    return fs.readFileSync(path.join(__dirname, '..', 'public', 'js', f), 'utf8');
  }).join('\n') + '\n' + names.map(function (n) { return 'this.' + n + ' = ' + n + ';'; }).join('\n');
  vm.runInContext(code, sandbox);
  return sandbox;
}

let failed = 0;
function check(name, condition) {
  console.log((condition ? 'PASS  ' : 'FAIL  ') + name);
  if (!condition) { failed++; }
}

/* ---------------- game rules ---------------- */

const lib = load(['events.js', 'game.js'], ['EventBus', 'GameRules']);
const bus = lib.EventBus;
const seen = [];
['answer:correct', 'answer:wrong', 'level:up', 'game:won', 'answer:invalid'].forEach(function (name) {
  bus.on(name, function (data) { seen.push(name + (data && data.reason ? ':' + data.reason : '')); });
});
function count(name) { return seen.filter(function (x) { return x === name; }).length; }

const game = lib.GameRules.create(bus);

game.reset();
check('new game starts at level 1, question 1, with a level name',
  game.getState().level === 1 && game.getState().step === 0 && game.getState().levelName === 'Lonely Water');

// the third question of every level is the Fish Game picture
check('questions 1 and 2 are quiz questions, question 3 is the reef challenge', (function () {
  const types = [];
  for (let i = 0; i < 3; i++) { types.push(game.nextSpec().type); game.setQuestion(0); game.submit('0', 0); }
  game.reset();
  return types.join() === 'choice,choice,fish';
})());

// stuck rule: a mistake sends you back to question 1 of the SAME level
game.reset(); seen.length = 0;
game.setQuestion(1); game.submit('1', 5);
game.setQuestion(1); game.submit('1', 5);
check('two correct answers move on to question 3', game.getState().step === 2);
game.setQuestion(1); game.submit('2', 5);
check('a wrong answer sends the player back to question 1 of the same level',
  game.getState().step === 0 && game.getState().level === 1 && game.getState().mistakes === 1);

// time out counts as a wrong answer, and only once per question
game.setQuestion(1); game.timeout(); game.timeout();
check('a time out counts as ONE wrong answer (reason "time")',
  game.getState().mistakes === 2 && count('answer:wrong:time') === 1);

// bad input
const before = JSON.stringify(game.getState());
game.setQuestion(1); game.submit('abc', 5); game.submit('-3', 5); game.submit('', 5); game.submit('2.5', 5);
check('text, negative numbers, empty and decimal answers are rejected without changing the game',
  count('answer:invalid') === 4 && JSON.stringify(game.getState()) === before);

// a full winning game: 6 levels x 3 questions, answered instantly (no bonus seconds)
game.reset(); seen.length = 0;
for (let i = 0; i < 18; i++) { game.setQuestion(0); game.submit('0', 0); }
check('18 correct answers in a row win the game', count('game:won') === 1 && game.getState().active === false);
check('5 level-up events happen on the way (levels 2 to 6)', count('level:up') === 5);
check('score is 10 x level for each answer: 30 x (1+2+3+4+5+6) = 630', game.getState().score === 630);

// difficulty grows
game.reset();
const spec1 = game.nextSpec();
for (let i = 0; i < 12; i++) { game.setQuestion(0); game.submit('0', 0); }      // pass levels 1-4
for (let i = 0; i < 1; i++) { game.setQuestion(0); game.submit('0', 0); }
const spec5 = game.nextSpec();
check('shrimp sum gets harder: 1 each on level 1, 3 each on level 5', spec1.shrimpEach === 1 && spec5.shrimpEach === 3);
check('level 1 is easy and level 5 is hard', spec1.difficulty === 'easy' && spec5.difficulty === 'hard');

/* ---------------- question bank ---------------- */

const bank = load(['questions.js'], ['QuestionBank']).QuestionBank;
['easy', 'medium', 'hard'].forEach(function (level) {
  const list = bank.data[level];
  check(level + ': at least 10 questions', list.length >= 10);
  check(level + ': every question has 4 different answers', list.every(function (q) {
    const all = [q.correct].concat(q.wrong);
    return all.length === 4 && new Set(all).size === 4;
  }));
  check(level + ': no question is repeated', new Set(list.map(function (q) { return q.text; })).size === list.length);
  check(level + ': the right answer is always found at answerIndex (checked 200 times)', (function () {
    for (let i = 0; i < 200; i++) {
      const q = bank.next(level);
      const original = list.find(function (x) { return x.text === q.text; });
      if (q.options[q.answerIndex] !== original.correct) { return false; }
    }
    return true;
  })());
});

console.log(failed === 0 ? '\nAll checks passed.' : '\n' + failed + ' check(s) FAILED.');
process.exit(failed === 0 ? 0 : 1);
