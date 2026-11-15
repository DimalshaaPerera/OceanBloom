/*
 * ocean.js - THE SCENE (decides what is on the canvas and animates it)
 * ---------------------------------------------------------------------
 * HIGH COHESION: this file only runs the animated ocean picture. It does not know
 * about questions, scores, passwords or the web service. The drawing of each
 * creature lives in creatures.js; this file decides which ones are visible at
 * which level, and moves them.
 *
 * The rest of the program talks to it with only six simple calls:
 *   Ocean.init(canvas)        start the animation
 *   Ocean.setLevel(n, now)    the fish grows and the ocean gets more beautiful
 *   Ocean.cheer()             happy jump with hearts (correct answer)
 *   Ocean.oops()              little shake (wrong answer or time out)
 *   Ocean.banner(text)        big title that fades away (e.g. "Level 2: Bubble Bay")
 *   Ocean.celebrate()         confetti rain and fireworks (game won)
 *   Ocean.sharkPass()         a shark swims across (the "shark attack" question)
 *   Ocean.setUrgency(0..1)    red pulsing edges when the countdown is nearly over
 *
 * What appears (everything from the lower levels stays):
 *   Level 1  small orange fish in an empty, dark ocean (drifting specks, it blows the odd bubble)
 *   Level 2  lighter water, sunbeams, dancing light, bubbles, glowing dust, a jellyfish. Fish gets stripes.
 *   Level 3  hills, sandy floor, rocks, swaying seaweed, a sea turtle, a crab. Fish glows softly.
 *   Level 4  colourful coral, anemones, starfish, a seahorse, a manta ray. Fish grows a big top fin.
 *   Level 5  a whale far away, a school of little fish, a second jellyfish, an octopus, a clam with a pearl
 *   Level 6  open treasure chest, brightest water, rainbow fish with a crown
 *
 * Move your mouse over the canvas and the fish swims towards it. Click the water
 * and the fish darts there in a burst of bubbles.
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const Ocean = {
  canvas: null,
  ctx: null,
  W: 900,
  H: 420,
  time: 0,
  level: 1,

  // the hero fish
  fx: 380, fy: 190,                 // where it is
  dir: 1,                           // 1 = looking right, -1 = looking left
  tilt: 0,                          // nose up / nose down angle
  scale: 0.8, targetScale: 0.8,     // size, grows smoothly
  jumpT: -1,                        // seconds since the happy jump began (-1 = not jumping)
  shakeT: -1,                       // seconds since the shake began
  mouse: { x: 0, y: 0, inside: false },

  // things in the scene
  bubbles: [], dust: [], jellies: [], school: [], pops: [], snow: [], ripples: [],
  turtle: { x: -100, y: 150 },
  whale: { x: 700, y: 70 },
  crab: { x: 300, dir: 1, pause: 0 },
  manta: { x: -150, y: 110 },
  shark: { active: false, x: 0, y: 0 },
  fireworks: 0, fireworkWait: 0,
  urgency: 0,
  dash: 0,                          // > 0 while the fish darts towards a click
  flash: { alpha: 0, color: '255,255,255' },
  bannerText: '', bannerT: 99,

  FISH_SCALES: [0.8, 1.2, 1.6, 2.0, 2.4, 2.8],   // fish size for levels 1..6
  FISH_COLORS: ['#ff9f43', '#ff6b9d', '#ffd93d', '#a66bff', '#ff5a5f', '#ffd23f'],
  CONFETTI: ['#ff6b9d', '#ffd93d', '#6be9ff', '#7cf29a', '#a66bff', '#ff9f43'],

  /* ---------- starting ---------- */

  paused: false,                 // true while the game is paused

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.fx = this.W * 0.42;
    this.fy = this.H * 0.45;
    this.setLevel(1, true);

    // EVENT: the fish follows the mouse pointer while it is over the canvas.
    const self = this;
    window.addEventListener('mousemove', function (e) {
      const box = canvas.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width;
      const y = (e.clientY - box.top) / box.height;
      self.mouse.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      self.mouse.x = x * self.W;
      self.mouse.y = y * self.H;
    });

    // EVENT: click (or tap) the water - a ring of bubbles, and the fish darts there.
    canvas.addEventListener('pointerdown', function (e) {
      if (self.paused) { return; }
      const box = canvas.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width * self.W;
      const y = (e.clientY - box.top) / box.height * self.H;
      self.poke(x, y);
    });

    // marine snow: tiny specks drifting down at every level (makes the water feel deep)
    this.snow = [];
    for (let i = 0; i < 45; i++) {
      this.snow.push({ x: Math.random() * this.W, y: Math.random() * this.H, r: 0.6 + Math.random() * 1.2, speed: 0.08 + Math.random() * 0.2, phase: Math.random() * 6 });
    }

    function frame() {
      if (!self.paused) { self.update(); }   // paused: the scene stands still
      self.draw();
      if (self.paused) { self.drawPaused(); }
      requestAnimationFrame(frame);
    }
    frame();
  },

  /* ---------- the six calls used by the rest of the program ---------- */

  setLevel(level, instant) {
    const changed = this.level !== level;
    this.level = level;
    this.targetScale = this.FISH_SCALES[Math.min(level, 6) - 1];
    if (instant) { this.scale = this.targetScale; }

    // ambient bubbles and glowing dust (not in the empty level-1 ocean)
    this.bubbles = [];
    this.dust = [];
    if (level >= 2) {
      for (let i = 0; i < 6 + level * 3; i++) { this.bubbles.push(this.newBubble(true)); }
      for (let i = 0; i < 12 + level * 6; i++) {
        this.dust.push({ x: Math.random() * this.W, y: Math.random() * this.H, r: 1 + Math.random() * 1.6, phase: Math.random() * 6 });
      }
    }

    // jellyfish: one from level 2, a second from level 5
    this.jellies = [];
    if (level >= 2) { this.jellies.push({ x: 120, y: 120, size: 1.0, color: '#ff8de0', phase: 0 }); }
    if (level >= 5) { this.jellies.push({ x: 760, y: 200, size: 1.3, color: '#8de8ff', phase: 2 }); }

    // school of little fish from level 5
    this.school = [];
    if (level >= 5) {
      for (let i = 0; i < 6 + (level - 5) * 4; i++) {
        this.school.push({
          x: Math.random() * this.W, y: 50 + Math.random() * 200,
          speed: 0.6 + Math.random() * 0.9, size: 0.3 + Math.random() * 0.2,
          color: this.CONFETTI[i % 6], phase: Math.random() * 6
        });
      }
    }

    if (changed && !instant && level > 1) { this.levelUpEffects(); }
  },

  cheer() {                      // correct answer
    this.jumpT = 0;
    this.ripples.push({ x: this.fx, y: this.fy, r: 10 * this.scale, life: 1, color: '255,255,255' });
    for (let i = 0; i < 10; i++) {
      this.spawn('star', this.fx + (Math.random() - 0.5) * 100, this.fy + (Math.random() - 0.5) * 60, '#fff6a8', { vy: -0.6 - Math.random(), size: 3 + Math.random() * 4, decay: 0.025 });
    }
    for (let i = 0; i < 6; i++) {
      this.spawn('heart', this.fx + (Math.random() - 0.5) * 80, this.fy - 20, '#ff5d8f', { vy: -1 - Math.random(), size: 7 + Math.random() * 5 });
    }
  },

  oops() {                       // wrong answer or time out
    this.shakeT = 0;
    this.flash = { alpha: 0.22, color: '255,60,60' };
  },

  banner(text) {
    this.bannerText = text;
    this.bannerT = 0;
  },

  celebrate() {                  // game won: confetti rain + fireworks
    for (let i = 0; i < 160; i++) {
      this.spawn('confetti', Math.random() * this.W, -10 - Math.random() * 200,
        this.CONFETTI[i % 6], { vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, gravity: 0.01, decay: 0.003 });
    }
    this.fireworks = 10;
    this.fireworkWait = 0;
  },

  sharkPass() {                  // the shark swims across, right behind the hero
    const fromLeft = Math.random() < 0.5;
    this.shark = { active: true, x: fromLeft ? -180 : this.W + 180, y: this.H * 0.4, dir: fromLeft ? 1 : -1 };
  },

  setUrgency(u) {                // 0 = calm, 1 = time is nearly up
    this.urgency = this.clamp(u, 0, 1);
  },

  // The player clicked the water.
  poke(x, y) {
    this.ripples.push({ x: x, y: y, r: 4, life: 1, color: '255,255,255' });
    for (let i = 0; i < 8; i++) {
      this.bubbles.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 20, r: 2 + Math.random() * 4, speed: 0.8 + Math.random() * 1.2, temp: true });
    }
    this.mouse.x = x; this.mouse.y = y; this.mouse.inside = true;
    this.dash = 0.5;
  },

  /* ---------- little helpers ---------- */

  levelUpEffects() {
    this.flash = { alpha: 0.5, color: '255,255,255' };
    for (let i = 0; i < 3; i++) {
      this.ripples.push({ x: this.fx, y: this.fy, r: 10 + i * 30, life: 1 + i * 0.2, color: '255,246,168' });
    }
    for (let i = 0; i < 60; i++) {
      this.spawn('confetti', this.fx, this.fy, this.CONFETTI[i % 6],
        { vx: (Math.random() - 0.5) * 9, vy: -2 - Math.random() * 6, gravity: 0.12, decay: 0.012 });
    }
    for (let i = 0; i < 12; i++) {
      this.spawn('star', this.fx + (Math.random() - 0.5) * 160, this.fy + (Math.random() - 0.5) * 100, '#fff6a8', { vy: -0.5, size: 6 + Math.random() * 6 });
    }
  },

  // Add one short-lived effect (confetti piece, heart, star...) to the list.
  spawn(shape, x, y, color, extra) {
    if (this.pops.length > 400) { return; }
    const pop = { shape: shape, x: x, y: y, vx: 0, vy: -1, gravity: 0, life: 1, decay: 0.02, size: 5, color: color, spin: Math.random() * 6 };
    this.pops.push(Object.assign(pop, extra || {}));
  },

  newBubble(randomY) {
    return { x: Math.random() * this.W, y: randomY ? Math.random() * this.H : this.H + 10, r: 2 + Math.random() * 5, speed: 0.3 + Math.random() * 0.8 };
  },

  clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },

  /* ---------- one animation step (about 60 times a second) ---------- */

  update() {
    this.time += 0.016;
    const dt = 0.016;
    this.scale += (this.targetScale - this.scale) * 0.05;        // grow smoothly

    // --- hero fish: swim towards the mouse, or wander around when there is none
    let tx, ty;
    if (this.mouse.inside) {
      tx = this.mouse.x; ty = this.mouse.y;
    } else {
      tx = this.W * 0.42 + Math.sin(this.time * 0.5) * 140;
      ty = this.H * 0.42 + Math.sin(this.time * 0.9) * 45;
    }
    // keep the WHOLE fish (tail, fins and crown) inside the picture, however big it is
    const marginX = 62 * this.scale;
    const marginY = 40 * this.scale;
    tx = this.clamp(tx, marginX, this.W - marginX);
    ty = this.clamp(ty, marginY, this.H - marginY - (this.level >= 3 ? 30 : 0));
    const dx = tx - this.fx;
    const speed = this.dash > 0 ? 0.09 : 0.03;                   // darts after a click
    this.fx += dx * speed;
    this.fy += (ty - this.fy) * speed;
    if (this.dash > 0) {
      this.dash -= dt;
      if (Math.random() < 0.5) {                                  // a trail of bubbles while darting
        this.bubbles.push({ x: this.fx - 30 * this.scale * (this.dir >= 0 ? 1 : -1), y: this.fy, r: 1.5 + Math.random() * 2.5, speed: 0.5 + Math.random() * 0.6, temp: true });
      }
    }
    this.tilt = this.clamp((ty - this.fy) * 0.006, -0.35, 0.35);
    const wanted = dx > 4 ? 1 : (dx < -4 ? -1 : (this.dir >= 0 ? 1 : -1));
    this.dir += (wanted - this.dir) * 0.12;                       // the turn-around "flip"

    if (this.jumpT >= 0) { this.jumpT += dt; if (this.jumpT > 0.7) { this.jumpT = -1; } }
    if (this.shakeT >= 0) { this.shakeT += dt; if (this.shakeT > 0.6) { this.shakeT = -1; } }

    // the fish blows a bubble now and then
    if (Math.random() < 0.012) {
      this.bubbles.push({ x: this.fx + 30 * this.scale * (this.dir >= 0 ? 1 : -1), y: this.fy - 5, r: 2 + Math.random() * 3, speed: 0.6 + Math.random() * 0.6, temp: true });
    }
    // a rainbow fish leaves sparkles behind (level 6)
    if (this.level >= 6 && Math.random() < 0.25) {
      this.spawn('star', this.fx - 30 * this.scale * this.dir + (Math.random() - 0.5) * 20, this.fy + (Math.random() - 0.5) * 30,
        'hsl(' + ((this.time * 60) % 360) + ',100%,75%)', { vy: -0.2, size: 3 + Math.random() * 3, decay: 0.03 });
    }
    // the chest sparkles (level 6)
    if (this.level >= 6 && Math.random() < 0.08) {
      this.spawn('star', this.W - 130 + Math.random() * 60, this.H - 80, '#fff2a0', { vy: -0.8, size: 3 + Math.random() * 4, decay: 0.015 });
    }

    // --- bubbles (the ones the fish blew are removed at the top, the others start again at the bottom)
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y -= b.speed;
      b.x += Math.sin(this.time * 2 + i) * 0.3;
      if (b.y < -10) {
        if (b.temp) { this.bubbles.splice(i, 1); } else { this.bubbles[i] = this.newBubble(false); }
      }
    }

    // --- other creatures
    for (let i = 0; i < this.school.length; i++) {
      const f = this.school[i];
      f.x += f.speed;
      if (f.x > this.W + 60) { f.x = -60; }
    }
    for (let i = 0; i < this.jellies.length; i++) {
      this.jellies[i].x += 0.15;
      if (this.jellies[i].x > this.W + 60) { this.jellies[i].x = -60; }
    }
    this.turtle.x += 0.6;
    if (this.turtle.x > this.W + 120) { this.turtle.x = -120; }
    this.whale.x -= 0.2;
    if (this.whale.x < -160) { this.whale.x = this.W + 160; }
    this.manta.x += 0.45;
    if (this.manta.x > this.W + 160) { this.manta.x = -160; this.manta.y = 80 + Math.random() * 120; }

    // the crab scuttles along the sand, stops for a rest, then turns around
    const crab = this.crab;
    if (crab.pause > 0) {
      crab.pause -= dt;
    } else {
      crab.x += crab.dir * 0.8;
      if (crab.x > this.W - 60 || crab.x < 60 || Math.random() < 0.003) {
        crab.dir = crab.x > this.W - 60 ? -1 : (crab.x < 60 ? 1 : -crab.dir);
        crab.pause = 1 + Math.random() * 2;
      }
    }

    // the shark crosses the screen once, then goes away
    if (this.shark.active) {
      this.shark.x += this.shark.dir * 3.2;
      if (this.shark.x > this.W + 220 || this.shark.x < -220) { this.shark.active = false; }
    }

    // ripples grow and fade
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.r += 2.2;
      r.life -= 0.02;
      if (r.life <= 0) { this.ripples.splice(i, 1); }
    }

    // fireworks after winning: one burst every ~0.35 s
    if (this.fireworks > 0) {
      this.fireworkWait -= dt;
      if (this.fireworkWait <= 0) {
        this.fireworks--;
        this.fireworkWait = 0.35;
        const bx = 100 + Math.random() * (this.W - 200);
        const by = 60 + Math.random() * 140;
        const color = this.CONFETTI[Math.floor(Math.random() * 6)];
        for (let i = 0; i < 36; i++) {
          const a = (Math.PI * 2 * i) / 36;
          const v = 2 + Math.random() * 2;
          this.spawn('spark', bx, by, color, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0.04, decay: 0.018, size: 2.5 });
        }
        this.ripples.push({ x: bx, y: by, r: 5, life: 0.8, color: '255,255,255' });
      }
    }

    // marine snow drifts down slowly
    for (let i = 0; i < this.snow.length; i++) {
      const s = this.snow[i];
      s.y += s.speed;
      s.x += Math.sin(this.time * 0.6 + s.phase) * 0.15;
      if (s.y > this.H) { s.y = -2; s.x = Math.random() * this.W; }
    }

    // --- effects: confetti, hearts, stars
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
      p.life -= p.decay;
      if (p.life <= 0 || p.y > this.H + 20) { this.pops.splice(i, 1); }
    }
    this.flash.alpha = Math.max(0, this.flash.alpha - 0.012);
    this.bannerT += dt;
  },

  /* ---------- drawing (back to front, like layers of paper) ---------- */

  // Mix two #rrggbb colours: t = 0 gives c1, t = 1 gives c2.
  mix(c1, c2, t) {
    const a = parseInt(c1.slice(1), 16);
    const b = parseInt(c2.slice(1), 16);
    const r = Math.round((a >> 16) + ((b >> 16) - (a >> 16)) * t);
    const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
    const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  },

  draw() {
    const ctx = this.ctx;
    const level = this.level;
    const beauty = (Math.min(level, 6) - 1) / 5;     // 0 at level 1 ... 1 at level 6

    // 1. water: dull and dark at level 1, bright turquoise at level 6
    const water = ctx.createLinearGradient(0, 0, 0, this.H);
    water.addColorStop(0, this.mix('#2b4a5e', '#6fe3ff', beauty));
    water.addColorStop(1, this.mix('#0a1a26', '#1a4fb5', beauty));
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, this.W, this.H);

    // 2. far away things
    this.drawSnow();
    if (level >= 2) { this.drawCaustics(); this.drawRays(); this.drawSurface(); }
    if (level >= 5) { Draw.whale(ctx, this.whale.x, this.whale.y, 1.3, this.time); }
    if (level >= 4) { Draw.manta(ctx, this.manta.x, this.manta.y + Math.sin(this.time * 0.7) * 15, 0.8, this.time); }
    if (level >= 3) {
      this.drawHills('rgba(20, 60, 120, 0.35)', this.H - 110, 22, 0.012, 0);
      this.drawHills('rgba(20, 120, 140, 0.35)', this.H - 80, 16, 0.02, 2);
    }
    if (this.shark.active) {
      ctx.save();
      ctx.translate(this.shark.x, this.shark.y + Math.sin(this.time * 2) * 10);
      ctx.scale(this.shark.dir, 1);
      Draw.shark(ctx, 0, 0, 1.15, this.time);
      ctx.restore();
    }

    // 3. swimmers in the middle
    for (let i = 0; i < this.jellies.length; i++) {
      const j = this.jellies[i];
      Draw.jellyfish(ctx, j.x, j.y + Math.sin(this.time * 0.8 + j.phase) * 30, j.size, j.color, this.time);
    }
    if (level >= 3) { Draw.turtle(ctx, this.turtle.x, this.turtle.y + Math.sin(this.time) * 10, 0.9, this.time); }
    for (let i = 0; i < this.school.length; i++) {
      const f = this.school[i];
      Draw.fish(ctx, f.x, f.y + Math.sin(this.time * 2 + f.phase) * 6, f.size, f.color, 1, this.time, { phase: f.phase });
    }

    // 4. the sea floor
    if (level >= 3) {
      this.drawSand();
      Draw.rock(ctx, 240, this.H - 36, 70, 38);
      Draw.rock(ctx, 640, this.H - 34, 54, 28, '#7d8a78');
      this.drawSeaweed();
    }
    if (level >= 5) {
      Draw.octopus(ctx, 245, this.H - 72, 0.85, this.time, '#c56cf0');
      Draw.clam(ctx, 420, this.H - 26, 1, this.time);
    }
    if (level >= 4) {
      this.drawCoral();
      Draw.anemone(ctx, 60, this.H - 38, 0.9, this.time, '#ff8fc8');
      Draw.anemone(ctx, 580, this.H - 36, 0.75, this.time + 1, '#7cf2d4');
      this.drawStarfish();
      Draw.seahorse(ctx, this.W * 0.68, this.H - 120 + Math.sin(this.time) * 6, 1.1, '#ffb347', this.time);
    }
    if (level >= 3) {
      const c = this.crab;
      Draw.crab(ctx, c.x, this.H - 26, 0.8, c.pause > 0 ? 0 : this.time, '#ff5e3a');
    }
    if (level >= 6) { Draw.chest(ctx, this.W - 170, this.H - 90, 0.8, this.time); }

    // 5. the hero fish (in front of everything), with its shadow on the sand and a soft glow
    if (level >= 3) { this.drawShadow(); }
    if (level >= 3) { this.drawGlow(); }
    this.drawHero();

    // 6. in front: dust, bubbles, confetti, flashes and the title banner
    this.drawDust();
    this.drawBubbles();
    this.drawRipples();
    this.drawPops();
    this.drawVignette();
    if (this.flash.alpha > 0) {
      ctx.fillStyle = 'rgba(' + this.flash.color + ',' + this.flash.alpha + ')';
      ctx.fillRect(0, 0, this.W, this.H);
    }
    this.drawBanner();
  },

  // Dancing patches of sunlight (caustics). 'lighter' adds light on top of the water.
  drawCaustics() {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const strength = 0.03 + this.level * 0.012;
    for (let i = 0; i < 12; i++) {
      const x = ((i * 137) % this.W) + Math.sin(this.time * 0.7 + i * 1.7) * 60;
      const y = 40 + ((i * 89) % (this.H - 120)) + Math.cos(this.time * 0.5 + i) * 30;
      const r = 50 + Math.sin(this.time * 1.3 + i) * 18;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(200,255,255,' + strength + ')');
      g.addColorStop(1, 'rgba(200,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.4, r * 0.7, Math.sin(this.time * 0.3 + i), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  drawSnow() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(220,240,255,0.35)';
    for (let i = 0; i < this.snow.length; i++) {
      const s = this.snow[i];
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // a dark oval on the sand under the fish: smaller and fainter when the fish is high up
  drawShadow() {
    const ctx = this.ctx;
    const height = (this.H - 40 - this.fy) / this.H;          // 0 near the floor, ~1 at the top
    const w = 34 * this.scale * (1 - height * 0.4);
    ctx.fillStyle = 'rgba(40, 30, 10,' + (0.25 * (1 - height)) + ')';
    ctx.beginPath();
    ctx.ellipse(this.fx, this.H - 22, w, w * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // a soft halo around the hero fish (stronger at higher levels)
  drawGlow() {
    const ctx = this.ctx;
    const r = 70 * this.scale;
    const color = this.level >= 6 ? '255,240,160' : '255,255,255';
    const a = 0.06 + (this.level - 3) * 0.035 + Math.sin(this.time * 2) * 0.02;
    const g = ctx.createRadialGradient(this.fx, this.fy, 0, this.fx, this.fy, r);
    g.addColorStop(0, 'rgba(' + color + ',' + a + ')');
    g.addColorStop(1, 'rgba(' + color + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(this.fx - r, this.fy - r, r * 2, r * 2);
  },

  drawRipples() {
    const ctx = this.ctx;
    ctx.lineWidth = 2;
    for (let i = 0; i < this.ripples.length; i++) {
      const r = this.ripples[i];
      ctx.strokeStyle = 'rgba(' + r.color + ',' + Math.min(1, r.life) * 0.6 + ')';
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // Dark edges make the middle look lit (strong at level 1 = deep and lonely).
  // When time is nearly up the edges pulse red.
  drawVignette() {
    const ctx = this.ctx;
    const dark = 0.55 - (Math.min(this.level, 6) - 1) * 0.08;
    const g = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.35, this.W / 2, this.H / 2, this.W * 0.65);
    g.addColorStop(0, 'rgba(0,10,25,0)');
    g.addColorStop(1, 'rgba(0,10,25,' + dark + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    if (this.urgency > 0) {
      const pulse = 0.5 + Math.sin(this.time * 10) * 0.5;
      const red = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.3, this.W / 2, this.H / 2, this.W * 0.6);
      red.addColorStop(0, 'rgba(255,40,60,0)');
      red.addColorStop(1, 'rgba(255,40,60,' + (0.15 + pulse * 0.3) * this.urgency + ')');
      ctx.fillStyle = red;
      ctx.fillRect(0, 0, this.W, this.H);
    }
  },

  drawHero() {
    const level = this.level;
    let x = this.fx, y = this.fy, tilt = this.tilt;

    if (this.jumpT >= 0) {                                  // happy jump
      const p = Math.sin(Math.PI * Math.min(this.jumpT / 0.7, 1));
      y -= p * 60;
      tilt -= p * 0.5;
    }
    if (this.shakeT >= 0) {                                 // shake
      x += Math.sin(this.shakeT * 50) * 8 * (1 - this.shakeT / 0.6);
    }

    const color = level >= 6 ? 'hsl(' + ((this.time * 40) % 360) + ',90%,60%)' : this.FISH_COLORS[level - 1];
    Draw.fish(this.ctx, x, y, this.scale, color, this.dir, this.time, {
      stripe: level >= 2,
      topFin: level >= 4,
      crown: level >= 6,
      blink: (this.time % 4) > 3.85,                        // blinks every 4 seconds
      tilt: tilt
    });
  },

  drawRays() {
    const ctx = this.ctx;
    for (let i = 0; i < 5; i++) {
      const x = 80 + i * 190 + Math.sin(this.time * 0.4 + i) * 25;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.04 + this.level * 0.012) + ')';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 70, 0);
      ctx.lineTo(x + 170, this.H);
      ctx.lineTo(x + 20, this.H);
      ctx.closePath();
      ctx.fill();
    }
  },

  // a wavy bright band at the top (the water surface seen from below)
  drawSurface() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= this.W; x += 20) {
      ctx.lineTo(x, 14 + Math.sin(x * 0.03 + this.time * 2) * 5);
    }
    ctx.lineTo(this.W, 0);
    ctx.closePath();
    ctx.fill();
  },

  // soft hills far away, they give the picture depth
  drawHills(color, baseY, height, wave, phase) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, this.H);
    for (let x = 0; x <= this.W; x += 20) {
      ctx.lineTo(x, baseY + Math.sin(x * wave + phase + this.time * 0.1) * height);
    }
    ctx.lineTo(this.W, this.H);
    ctx.closePath();
    ctx.fill();
  },

  drawSand() {
    const ctx = this.ctx;
    const sand = ctx.createLinearGradient(0, this.H - 60, 0, this.H);
    sand.addColorStop(0, '#f3dfa8');
    sand.addColorStop(1, '#d9b87a');
    ctx.fillStyle = sand;
    ctx.beginPath();
    ctx.moveTo(0, this.H);
    ctx.lineTo(0, this.H - 40);
    for (let x = 0; x <= this.W; x += 50) {
      ctx.quadraticCurveTo(x + 25, this.H - 58, x + 50, this.H - 40);
    }
    ctx.lineTo(this.W, this.H);
    ctx.closePath();
    ctx.fill();
  },

  drawSeaweed() {
    const ctx = this.ctx;
    const greens = ['#2e9e5b', '#3cc47a', '#1fb5a3'];
    ctx.lineCap = 'round';
    ctx.lineWidth = 8;
    for (let i = 0; i < 10; i++) {
      const x = 30 + i * 95;
      const h = 70 + (i % 3) * 25;
      const sway = Math.sin(this.time * 1.5 + i) * 14;
      ctx.strokeStyle = greens[i % 3];
      ctx.beginPath();
      ctx.moveTo(x, this.H - 40);
      ctx.quadraticCurveTo(x + sway, this.H - 40 - h / 2, x + sway * 0.5, this.H - 40 - h);
      ctx.stroke();
    }
  },

  drawCoral() {
    const ctx = this.ctx;
    const colors = ['#ff6b81', '#ff9f43', '#c56cf0', '#ffd93d'];
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    for (let i = 0; i < 5; i++) {
      const x = 90 + i * 190;
      const base = this.H - 42;
      const sway = Math.sin(this.time + i) * 3;
      ctx.strokeStyle = colors[i % 4];
      ctx.fillStyle = colors[i % 4];
      const branches = [[-22, -50], [0, -70], [22, -48]];
      for (let j = 0; j < branches.length; j++) {
        const bx = x + branches[j][0] + sway;
        const by = base + branches[j][1];
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bx, by, 7 + Math.sin(this.time * 2 + i + j) * 1.2, 0, Math.PI * 2);   // tips "breathe"
        ctx.fill();
      }
    }
  },

  drawStarfish() {
    Draw.star(this.ctx, 150, this.H - 22, 14, 6, 5, '#ff7a59', 0.2);
    Draw.star(this.ctx, 520, this.H - 18, 11, 5, 5, '#ffd166', -0.3);
    Draw.star(this.ctx, 800, this.H - 24, 13, 6, 5, '#ff6b9d', 0.5);
  },

  drawDust() {
    const ctx = this.ctx;
    for (let i = 0; i < this.dust.length; i++) {
      const d = this.dust[i];
      d.x += 0.1; d.y -= 0.05;
      if (d.x > this.W) { d.x = 0; }
      if (d.y < 0) { d.y = this.H; }
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + Math.sin(this.time * 2 + d.phase) * 0.2) + ')';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawBubbles() {
    const ctx = this.ctx;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (b.r > 2.5) {                                          // a tiny shine makes it look round
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  drawPops() {
    const ctx = this.ctx;
    for (let i = 0; i < this.pops.length; i++) {
      const p = this.pops[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      if (p.shape === 'heart') {
        Draw.heart(ctx, p.x, p.y, p.size, p.color);
      } else if (p.shape === 'star') {
        Draw.star(ctx, p.x, p.y, p.size, p.size * 0.35, 4, p.color, this.time * 3 + p.spin);
      } else if (p.shape === 'spark') {                     // firework spark with a short tail
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.stroke();
      } else {                                              // confetti: a spinning little rectangle
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.time * 6 + p.spin);
        ctx.fillStyle = p.color;
        ctx.fillRect(-4, -2, 8, 4);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  },

  // A dark veil with a big pause sign over the frozen ocean.
  drawPaused() {
    const c = this.ctx;
    c.save();
    c.fillStyle = 'rgba(5, 20, 35, 0.55)';
    c.fillRect(0, 0, this.W, this.H);
    c.fillStyle = 'rgba(232, 246, 255, 0.92)';
    const x = this.W / 2, y = this.H / 2 - 18;
    c.fillRect(x - 26, y - 34, 18, 68);
    c.fillRect(x + 8, y - 34, 18, 68);
    c.font = 'bold 28px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('Paused', x, y + 76);
    c.restore();
  },

  drawBanner() {
    if (this.bannerT > 3) { return; }
    const ctx = this.ctx;
    const fadeIn = Math.min(this.bannerT / 0.4, 1);
    const fadeOut = Math.min((3 - this.bannerT) / 0.6, 1);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
    ctx.translate(this.W / 2, 70);
    const pop = 1 + (1 - fadeIn) * 0.5;                    // starts big, settles down
    ctx.scale(pop, pop);
    ctx.font = 'bold 40px system-ui, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(10, 40, 90, 0.8)';
    ctx.strokeText(this.bannerText, 0, 0);
    ctx.fillStyle = '#fff6a8';
    ctx.fillText(this.bannerText, 0, 0);
    ctx.restore();
  }
};
