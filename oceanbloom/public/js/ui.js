/*
 * ui.js - THE GAME SCREEN (HTML elements only)
 * --------------------------------------------
 * HIGH COHESION: reads from and writes to the HTML elements of game.html, nothing
 * else.
 *
 * EVENT-DRIVEN PROGRAMMING (input side): the browser generates DOM events (a form
 * is submitted, a button is clicked). This file turns each one into a named event
 * on the EventBus ("ui:submitAnswer", "ui:retry", ...). It does NOT decide what
 * happens next - main.js does.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const UI = {
  bus: null,

  $(id) {
    return document.getElementById(id);
  },

  init(bus) {
    this.bus = bus;
    const self = this;

    // DOM events -> our own events
    this.$('answerForm').addEventListener('submit', function (e) {
      e.preventDefault();
      bus.emit('ui:submitAnswer', { value: self.$('answer').value });
    });
    this.$('retryBtn').addEventListener('click', function () {
      bus.emit('ui:retry');
    });
    this.$('playAgainBtn').addEventListener('click', function () {
      bus.emit('ui:restart');
    });
  },

  /* ---------- which part of the page is visible ---------- */

  showPlaying() {
    this.$('endPanel').hidden = true;
    this.$('gamePanel').hidden = false;
  },

  showEnd(score, best, newRecord, mistakes, rank, saveFailed) {
    this.$('gamePanel').hidden = true;
    this.$('endPanel').hidden = false;
    this.$('endTitle').textContent = 'You did it - the ocean is in full bloom!';
    let text = 'Your score: ' + score + ' (mistakes: ' + mistakes + '). Your best score: ' + best + '.';
    if (newRecord) { text += ' New personal record!'; }
    if (rank) { text += ' Leaderboard position: #' + rank + '.'; }
    if (saveFailed) { text += ' (Your result could not be saved - is the server still running?)'; }
    this.$('endText').textContent = text;
  },

  /* ---------- game screen ---------- */

  updateHud(s) {
    this.$('hudLevel').textContent = 'Level ' + s.level + ' / ' + s.totalLevels + ' - ' + s.levelName;
    this.$('hudStep').textContent = 'Question ' + (s.step + 1) + ' of ' + s.stepsPerLevel;
    this.$('progressFill').style.width = (s.step / s.stepsPerLevel * 100) + '%';
    this.$('hudScore').textContent = s.score;
    this.$('hudMistakes').textContent = s.mistakes;
  },

  updateTimer(t) {
    this.$('timerFill').style.width = (t.remaining / t.total * 100) + '%';
    this.$('timerText').textContent = Math.ceil(t.remaining) + 's';
    this.$('timerBox').classList.toggle('low', t.remaining <= 5);
  },

  // Enable or disable everything the player can press to answer.
  setAnswerEnabled(on) {
    this.$('answer').disabled = !on;
    this.$('checkBtn').disabled = !on;
    const buttons = this.$('choices').querySelectorAll('button');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].disabled = !on;
    }
    if (on && !this.$('answerForm').hidden) { this.$('answer').focus(); }
  },

  showLoading() {
    this.$('loadingText').hidden = false;
    this.$('questionText').textContent = '';
    this.$('choices').textContent = '';
    this.$('puzzle').hidden = true;
    this.$('answerForm').hidden = true;
    this.$('retryBtn').hidden = true;
    this.$('answer').value = '';
    this.$('timerFill').style.width = '100%';
    this.$('timerText').textContent = '';
    this.$('timerBox').classList.remove('low');
    this.setAnswerEnabled(false);
  },

  // Multiple-choice ocean question: one button per option.
  showChoiceQuestion(q) {
    const self = this;
    this.$('loadingText').hidden = true;
    this.$('questionText').textContent = 'Ocean quiz: ' + q.text;
    const box = this.$('choices');
    box.textContent = '';
    q.options.forEach(function (option, index) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      button.textContent = option;
      button.addEventListener('click', function () {
        self.bus.emit('ui:submitAnswer', { value: index });
      });
      box.appendChild(button);
    });
    this.bus.emit('ui:questionShown');     // the countdown starts now
  },

  // "Feeding time" question: a picture from the Fish Game service plus a number box.
  showFishQuestion(imageUrl, shrimpEach) {
    const self = this;
    const img = this.$('puzzle');
    this.$('questionText').textContent = shrimpEach === 1
      ? 'Feeding time! Every fish eats 1 shrimp. Count the fish - how many shrimp do you need?'
      : 'Feeding time! Every fish eats ' + shrimpEach + ' shrimp. Count the fish - how many shrimp do you need in total?';
    img.onload = function () {
      self.$('loadingText').hidden = true;
      img.hidden = false;
      self.$('answerForm').hidden = false;
      self.setAnswerEnabled(true);
      self.bus.emit('ui:questionShown');   // the countdown starts when the picture is visible
    };
    img.onerror = function () {
      self.showError('The picture could not be loaded.');
    };
    img.src = imageUrl;
  },

  // After the answer: mark which choice was the right one.
  highlightChoice(index) {
    const buttons = this.$('choices').querySelectorAll('button');
    if (buttons[index]) { buttons[index].classList.add('right'); }
  },

  showError(text) {
    this.$('loadingText').hidden = true;
    this.showFeedback(text, 'bad');
    this.$('retryBtn').hidden = false;
  },

  showFeedback(text, kind) {
    const el = this.$('feedback');
    el.textContent = text;
    el.className = 'msg ' + (kind || '');
  }
};
