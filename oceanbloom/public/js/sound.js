/*
 * sound.js - SOUND EFFECTS AND OCEAN MUSIC (Web Audio API, no sound files)
 * ------------------------------------------------------------------------
 * HIGH COHESION: this file only makes sounds. It knows nothing about questions,
 * scores or the canvas. Other files just call e.g. Sound.play('correct').
 *
 * Every sound is SYNTHESISED in the browser with oscillators (beeps / tones) and
 * filtered noise (water, splashes), so there are no audio files to download.
 *
 *   Sound.init()             (runs by itself when the file loads) adds the two toggle buttons (effects / music) and
 *                            plays a soft click on every button press
 *   Sound.play(name)         one effect: click, hover, correct, wrong, timeout,
 *                            tick, levelUp, win, bubble, shark, question, type
 *   Sound.setMood(level)     the background music gets brighter at higher levels
 *
 * Browsers only allow sound after the player has clicked or pressed a key, so the
 * audio starts on the first click. The player's on/off choices are remembered in
 * localStorage (if the browser allows it).
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const Sound = {
  ctx: null,
  master: null, sfxBus: null, musicBus: null, echo: null,
  sfxOn: true,
  musicOn: true,
  mood: 1,
  musicTimer: null,
  waves: null,
  lastHover: 0,

  // C major pentatonic (calm, never sounds "wrong"), as semitones from the root
  SCALE: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21],

  /* ---------- settings (remembered between visits) ---------- */

  load(key, fallback) {
    try {
      const v = localStorage.getItem('ob_' + key);
      return v === null ? fallback : v === '1';
    } catch (e) { return fallback; }
  },
  save(key, on) {
    try { localStorage.setItem('ob_' + key, on ? '1' : '0'); } catch (e) { /* private mode: not remembered */ }
  },

  /* ---------- starting ---------- */

  init() {
    this.sfxOn = this.load('sfx', true);
    this.musicOn = this.load('music', true);
    this.buildToggles();

    const self = this;
    // The first click / key press unlocks audio in the browser.
    function unlock() {
      self.start();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    }
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    // EVENT DELEGATION: one listener plays a click for every button / button-link on the page.
    document.addEventListener('click', function (e) {
      const el = e.target.closest ? e.target.closest('button, a.button, .navlinks a') : null;
      if (el && !el.classList.contains('sound-toggle')) { self.play('click'); }
    });
    document.addEventListener('pointerover', function (e) {
      const el = e.target.closest ? e.target.closest('button.choice:not(:disabled)') : null;
      if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) { self.play('hover'); }
    });
    document.addEventListener('input', function (e) {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'password') { self.play('type'); }
    });
  },

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { return; }                         // very old browser: just stay silent
    const ctx = this.ctx = new AC();

    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    // a gentle compressor stops loud effects from crackling when they overlap
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 1 : 0;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 1 : 0;
    this.musicBus.connect(this.master);

    // an underwater "echo" (delay with feedback) that the music notes go through
    this.echo = ctx.createDelay(1.0);
    this.echo.delayTime.value = 0.38;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1600;
    this.echo.connect(tone);
    tone.connect(fb);
    fb.connect(this.echo);
    tone.connect(this.musicBus);

    this.startWaves();
    this.scheduleMusic();
  },

  /* ---------- toggle buttons (bottom-right corner of every page) ---------- */

  buildToggles() {
    const self = this;
    const box = document.createElement('div');
    box.className = 'sound-toggles';

    function make(label, title, getOn, setOn) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sound-toggle';
      b.title = title;
      b.setAttribute('aria-label', title);
      function refresh() {
        b.textContent = label;
        b.classList.toggle('off', !getOn());
        b.setAttribute('aria-pressed', getOn() ? 'true' : 'false');
      }
      b.addEventListener('click', function () { setOn(!getOn()); refresh(); });
      refresh();
      box.appendChild(b);
    }

    make('\u{1F50A}', 'Sound effects on / off',
      function () { return self.sfxOn; },
      function (on) {
        self.sfxOn = on; self.save('sfx', on);
        if (self.sfxBus) { self.fade(self.sfxBus.gain, on ? 1 : 0, 0.05); }
        if (on) { self.play('bubble'); }
      });
    make('\u{1F3B5}', 'Ocean music on / off',
      function () { return self.musicOn; },
      function (on) {
        self.musicOn = on; self.save('music', on);
        if (self.musicBus) { self.fade(self.musicBus.gain, on ? 1 : 0, 0.6); }
      });

    document.body.appendChild(box);
  },

  fade(param, value, seconds) {
    const now = this.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + seconds);
  },

  setMood(level) {
    this.mood = Math.max(1, Math.min(6, level || 1));
    if (this.waves) {
      // calmer, darker water at level 1; brighter "shimmer" at level 6
      this.fade(this.waves.filter.frequency, 380 + this.mood * 90, 2);
    }
  },

  /* ---------- building blocks ---------- */

  // One tone. freq in Hz, `slide` (optional) = frequency to glide to.
  tone(freq, dur, opt) {
    opt = opt || {};
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (opt.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opt.slide) { osc.frequency.exponentialRampToValueAtTime(opt.slide, t0 + dur); }
    const vol = opt.vol === undefined ? 0.25 : opt.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (opt.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(opt.out || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    return g;
  },

  // A short burst of filtered noise (splashes, whooshes, ticks).
  noise(dur, opt) {
    opt = opt || {};
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (opt.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const f = ctx.createBiquadFilter();
    f.type = opt.filter || 'bandpass';
    f.frequency.setValueAtTime(opt.freq || 1000, t0);
    if (opt.sweep) { f.frequency.exponentialRampToValueAtTime(opt.sweep, t0 + dur); }
    f.Q.value = opt.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opt.vol || 0.2, t0 + (opt.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(opt.out || this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  },

  noiseBuffer() {
    if (this._noise) { return this._noise; }
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) { data[i] = Math.random() * 2 - 1; }
    this._noise = buf;
    return buf;
  },

  // MIDI note number -> frequency in Hz (69 = A4 = 440 Hz)
  hz(note) { return 440 * Math.pow(2, (note - 69) / 12); },

  /* ---------- the sound effects ---------- */

  play(name) {
    if (!this.ctx || !this.sfxOn) { return; }
    if (this.ctx.state === 'suspended') { this.ctx.resume(); }
    const fx = this.FX[name];
    if (fx) { fx.call(this); }
  },

  FX: {
    click() {
      this.tone(880, 0.06, { type: 'triangle', vol: 0.12, slide: 1300 });
    },
    hover() {
      const now = performance.now();
      if (now - this.lastHover < 60) { return; }
      this.lastHover = now;
      this.tone(1500 + Math.random() * 300, 0.05, { vol: 0.04 });
    },
    type() {
      this.noise(0.03, { freq: 3000 + Math.random() * 1500, q: 4, vol: 0.05 });
    },
    bubble() {                                    // a "bloop": fast rising sine
      const f = 300 + Math.random() * 250;
      this.tone(f, 0.14, { vol: 0.18, slide: f * 3 });
    },
    question() {                                  // a new question appears: soft two-note sonar ping
      this.tone(this.hz(84), 0.6, { vol: 0.09 });
      this.tone(this.hz(91), 0.8, { vol: 0.06, delay: 0.12 });
    },
    correct() {                                   // happy rising arpeggio + sparkle
      const notes = [72, 76, 79, 84];
      for (let i = 0; i < notes.length; i++) {
        this.tone(this.hz(notes[i]), 0.35, { type: 'triangle', vol: 0.18, delay: i * 0.07 });
      }
      this.tone(this.hz(96), 0.5, { vol: 0.06, delay: 0.3 });
      this.FX.bubble.call(this);
    },
    wrong() {                                     // low "bwomp" falling down
      this.tone(220, 0.45, { type: 'sawtooth', vol: 0.09, slide: 110 });
      this.tone(233, 0.45, { type: 'square', vol: 0.05, slide: 104, delay: 0.02 });
      this.noise(0.3, { filter: 'lowpass', freq: 400, vol: 0.12 });
    },
    timeout() {                                   // alarm: two falling beeps then the wrong sound
      this.tone(988, 0.12, { type: 'square', vol: 0.07 });
      this.tone(784, 0.18, { type: 'square', vol: 0.07, delay: 0.14 });
      this.tone(196, 0.5, { type: 'sawtooth', vol: 0.08, slide: 98, delay: 0.32 });
    },
    tick() {                                      // clock tick in the last 5 seconds
      this.noise(0.04, { freq: 2500, q: 8, vol: 0.18 });
      this.tone(1200, 0.05, { type: 'square', vol: 0.03 });
    },
    shark() {                                     // the shark swims past: deep whoosh + "da-dum"
      this.noise(1.4, { filter: 'lowpass', freq: 200, sweep: 1200, vol: 0.25, attack: 0.5 });
      this.tone(this.hz(40), 0.35, { type: 'sawtooth', vol: 0.14 });
      this.tone(this.hz(41), 0.35, { type: 'sawtooth', vol: 0.16, delay: 0.4 });
    },
    levelUp() {                                   // fanfare
      const seq = [[67, 0], [72, 0.12], [76, 0.24], [79, 0.36], [84, 0.5]];
      for (let i = 0; i < seq.length; i++) {
        this.tone(this.hz(seq[i][0]), 0.4, { type: 'triangle', vol: 0.18, delay: seq[i][1] });
        this.tone(this.hz(seq[i][0] - 12), 0.4, { type: 'sine', vol: 0.1, delay: seq[i][1] });
      }
      this.tone(this.hz(88), 1.2, { vol: 0.08, delay: 0.5, attack: 0.05 });   // shimmer on top
      this.noise(1.0, { filter: 'highpass', freq: 5000, vol: 0.05, delay: 0.5, attack: 0.1 });
      for (let i = 0; i < 6; i++) {
        const f = 400 + Math.random() * 500;
        this.tone(f, 0.15, { vol: 0.08, slide: f * 3, delay: 0.6 + i * 0.08 });
      }
    },
    win() {                                       // victory tune with chords
      const melody = [[72, 0], [76, 0.15], [79, 0.3], [84, 0.45], [79, 0.7], [84, 0.85], [88, 1.0]];
      for (let i = 0; i < melody.length; i++) {
        this.tone(this.hz(melody[i][0]), 0.45, { type: 'triangle', vol: 0.18, delay: melody[i][1] });
      }
      [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]].forEach(function (chord, i) {
        chord.forEach(function (n) {
          this.tone(this.hz(n), 0.6, { type: 'sine', vol: 0.06, delay: i * 0.35, attack: 0.04 });
        }, this);
      }, this);
      this.tone(this.hz(96), 2.0, { vol: 0.05, delay: 1.0, attack: 0.1 });
      for (let i = 0; i < 12; i++) {
        this.noise(0.25, { freq: 1500 + Math.random() * 3000, q: 2, vol: 0.06, delay: 1.2 + i * 0.12 });  // fireworks crackle
      }
    }
  },

  /* ---------- ocean ambience: waves + gentle generative music ---------- */

  // Looping noise through a low-pass filter whose volume rises and falls like waves.
  startWaves() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380 + this.mood * 90;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    // LFO = a very slow oscillator that moves the volume up and down (one wave every ~7 s)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.14;
    const depth = ctx.createGain();
    depth.gain.value = 0.035;
    lfo.connect(depth);
    depth.connect(g.gain);
    src.connect(filter); filter.connect(g); g.connect(this.musicBus);
    src.start(); lfo.start();
    this.waves = { filter: filter };
  },

  // Every so often play one soft note from the pentatonic scale, through the echo.
  // Higher levels: more notes and a higher register, so the music "blooms" with the reef.
  scheduleMusic() {
    const self = this;
    function next() {
      const gap = 1400 - self.mood * 140 + Math.random() * 900;
      self.musicTimer = setTimeout(next, gap);
      if (!self.ctx || !self.musicOn || self.ctx.state !== 'running' || document.hidden) { return; }
      const root = 57 + (self.mood >= 4 ? 3 : 0);                 // A3, or C4 from level 4
      const top = Math.min(self.SCALE.length, 5 + self.mood);
      const n = root + self.SCALE[Math.floor(Math.random() * top)];
      const out = self.ctx.createGain();
      out.gain.value = 1;
      out.connect(self.musicBus);
      out.connect(self.echo);
      self.tone(self.hz(n), 2.6, { type: 'sine', vol: 0.05, attack: 0.25, out: out });
      if (Math.random() < 0.25 + self.mood * 0.05) {             // sometimes a second note (harmony)
        const h = root + self.SCALE[Math.floor(Math.random() * top)] + 12;
        self.tone(self.hz(h), 2.0, { type: 'triangle', vol: 0.02, attack: 0.3, delay: 0.2, out: out });
      }
      if (Math.random() < 0.15) {                                 // and a distant bubble
        const f = 250 + Math.random() * 200;
        self.tone(f, 0.15, { vol: 0.03, slide: f * 3, out: out });
      }
    }
    next();
  }
};

Sound.init();
