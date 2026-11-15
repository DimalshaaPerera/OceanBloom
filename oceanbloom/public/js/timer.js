/*
 * timer.js - COUNTDOWN
 * --------------------
 * HIGH COHESION: only counts down. It knows nothing about questions or scores.
 *
 * EVENT-DRIVEN: it does not decide what "time is up" means. It just announces:
 *   timer:tick     { remaining, total }   about 10 times a second
 *   timer:expired                         when the time has run out
 * pause() / resume() freeze and continue the countdown (the pause button),
 * and whoever is interested (the screen bar, the game rules) reacts.
 *
 * It measures time with Date.now() rather than counting ticks, so the browser
 * slowing down a background tab cannot give the player extra time.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const Timer = {
  bus: null,
  handle: null,
  total: 0,
  endAt: 0,

  init(bus) {
    this.bus = bus;
  },

  paused: false,
  pausedLeft: 0,

  start(seconds) {
    this.stop();
    this.total = seconds;
    this.endAt = Date.now() + seconds * 1000;
    this.bus.emit('timer:tick', { remaining: seconds, total: seconds });
    this.run();
  },

  // Freeze the countdown: remember how many seconds were left.
  pause() {
    if (!this.handle) { return; }
    const left = Math.max(0, (this.endAt - Date.now()) / 1000);
    this.stop();
    this.paused = true;
    this.pausedLeft = left;
  },

  // Carry on from where pause() stopped, with exactly the same time left.
  resume() {
    if (!this.paused) { return; }
    this.paused = false;
    this.endAt = Date.now() + this.pausedLeft * 1000;
    this.run();
  },

  run() {
    const self = this;
    this.handle = setInterval(function () {
      const left = (self.endAt - Date.now()) / 1000;
      if (left <= 0) {
        self.stop();
        self.bus.emit('timer:tick', { remaining: 0, total: self.total });
        self.bus.emit('timer:expired');
      } else {
        self.bus.emit('timer:tick', { remaining: left, total: self.total });
      }
    }, 100);
  },

  stop() {
    this.paused = false;
    if (this.handle) {
      clearInterval(this.handle);
      this.handle = null;
    }
  },

  // Seconds left right now (0 if the timer is not running).
  remaining() {
    if (this.paused) { return this.pausedLeft; }
    return this.handle ? Math.max(0, (this.endAt - Date.now()) / 1000) : 0;
  }
};
