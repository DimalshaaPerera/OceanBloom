/*
 * creatures.js - DRAWING HELPERS (the "paint box")
 * ------------------------------------------------
 * HIGH COHESION: every function in this file draws ONE thing (a fish, a jellyfish,
 * a turtle, ...) on a canvas and does nothing else. No game rules, no timers, no
 * server calls. ocean.js decides WHEN and WHERE to draw them.
 *
 * How to read a drawing function:
 *   ctx.save()            remember the current canvas settings
 *   ctx.translate(x, y)   move the "pen" to where the thing should be drawn
 *   ctx.scale(s, s)       make it bigger or smaller
 *   ... draw shapes at (0, 0) ...
 *   ctx.restore()         go back to the remembered settings
 *
 * Code origin: generated with Claude (Anthropic), then read, tested and adapted by
 * me. (Student: edit to reflect your own changes.)
 */
const Draw = {

  /* ----- small shapes used by many things ----- */

  // A star with `points` spikes (4 = sparkle, 5 = starfish).
  star(ctx, x, y, outer, inner, points, color, spin) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin || 0);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI * i) / points - Math.PI / 2;
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  heart(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.3);
    ctx.bezierCurveTo(x - size, y - size * 0.5, x - size * 0.6, y - size * 1.1, x, y - size * 0.5);
    ctx.bezierCurveTo(x + size * 0.6, y - size * 1.1, x + size, y - size * 0.5, x, y + size * 0.3);
    ctx.fill();
  },

  /* ----- the hero fish (also used for the little school) -----
     opt (all optional): stripe, topFin, crown, blink, tilt, phase               */
  fish(ctx, x, y, size, color, dir, t, opt) {
    opt = opt || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size * dir, size);          // dir = 1 faces right, -1 faces left
    if (opt.tilt) { ctx.rotate(opt.tilt); }

    // tail (wags left and right)
    ctx.save();
    ctx.translate(-26, 0);
    ctx.rotate(Math.sin(t * 6 + (opt.phase || 0)) * 0.28);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-26, -19);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-26, 19);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // extra top fin (the fish "evolves" at level 4)
    if (opt.topFin) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.moveTo(-14, -15);
      ctx.lineTo(-4, -36 + Math.sin(t * 5) * 2);
      ctx.lineTo(16, -16);
      ctx.closePath();
      ctx.fill();
    }

    // body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 19, 0, 0, Math.PI * 2);
    ctx.fill();

    // white stripes (appear at level 2). clip() keeps them inside the body.
    if (opt.stripe) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, 32, 19, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-12, -20, 7, 40);
      ctx.fillRect(4, -20, 5, 40);
      ctx.restore();
    }

    // belly highlight and side fin
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 8, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(8, 14);
    ctx.lineTo(-16, 12);
    ctx.closePath();
    ctx.fill();

    // cheek blush and smile
    ctx.fillStyle = 'rgba(255,90,130,0.45)';
    ctx.beginPath();
    ctx.arc(16, 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(30, 3);
    ctx.quadraticCurveTo(26, 9, 21, 6);
    ctx.stroke();

    // eye (closes for a moment when blink is true)
    if (opt.blink) {
      ctx.beginPath();
      ctx.moveTo(15, -5);
      ctx.lineTo(24, -5);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(19, -5, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(20.5, -5, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // golden crown (level 6)
    if (opt.crown) {
      ctx.save();
      ctx.translate(12, -17);
      ctx.rotate(-0.15);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(-10, -13);
      ctx.lineTo(-4, -7);
      ctx.lineTo(0, -16);
      ctx.lineTo(4, -7);
      ctx.lineTo(10, -13);
      ctx.lineTo(9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.arc(0, -4, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  },

  /* ----- jellyfish: a glowing bell that pulses, with wavy tentacles ----- */
  jellyfish(ctx, x, y, size, color, t) {
    const pulse = 1 + Math.sin(t * 3) * 0.1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);

    // tentacles
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 8, 4);
      for (let k = 1; k <= 5; k++) {
        ctx.lineTo(i * 8 + Math.sin(t * 3 + k + i) * 5, 4 + k * 9);
      }
      ctx.stroke();
    }

    // bell (glows)
    ctx.globalAlpha = 0.85;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22 * pulse, 18 / pulse, 0, Math.PI, 0);
    ctx.quadraticCurveTo(14, 8, 8, 4);
    ctx.quadraticCurveTo(0, 10, -8, 4);
    ctx.quadraticCurveTo(-14, 8, -22 * pulse, 0);
    ctx.fill();
    ctx.shadowBlur = 0;

    // shiny spot
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-8, -8, 6, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /* ----- sea turtle (faces right) ----- */
  turtle(ctx, x, y, size, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    const flap = Math.sin(t * 2.2) * 0.5;

    // flippers: far side first (darker), then near side
    ctx.fillStyle = '#2f9e6d';
    [[16, 12, flap], [-16, 12, -flap], [14, -2, flap], [-14, -2, -flap]].forEach(function (f) {
      ctx.save();
      ctx.translate(f[0], f[1]);
      ctx.rotate(f[2] + 0.4);
      ctx.beginPath();
      ctx.ellipse(0, 10, 6, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // head and tail
    ctx.fillStyle = '#8fd694';
    ctx.beginPath();
    ctx.arc(36, -3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(-42, 4);
    ctx.lineTo(-30, 6);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(39, -5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // shell
    ctx.fillStyle = '#3fbf7f';
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a8f5d';
    [[0, 0, 9], [-16, -2, 6], [16, -2, 6], [-8, 10, 6], [8, 10, 6], [-8, -11, 6], [8, -11, 6]].forEach(function (h) {
      ctx.beginPath();
      ctx.arc(h[0], h[1], h[2], 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  },

  /* ----- seahorse (a curved body with a curly tail) ----- */
  seahorse(ctx, x, y, size, color, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.rotate(Math.sin(t * 1.5) * 0.08);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';

    // body and curly tail
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.bezierCurveTo(12, -12, 10, 8, -2, 14);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-6, 20, 7, -0.6, Math.PI * 1.4);
    ctx.stroke();

    // head, snout, spiky back and eye
    ctx.beginPath();
    ctx.arc(0, -28, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(4, -30, 13, 4);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-6, -20 + i * 8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(2, -30, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /* ----- a big, faint whale far in the background ----- */
  whale(ctx, x, y, size, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.fillStyle = 'rgba(15, 50, 110, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 90, 32, 0, 0, Math.PI * 2);          // body
    ctx.fill();
    ctx.save();
    ctx.translate(-88, 0);
    ctx.rotate(Math.sin(t * 1.2) * 0.2);                    // tail swings
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-38, -30);
    ctx.lineTo(-30, 0);
    ctx.lineTo(-38, 30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(62, -6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /* ----- shark (faces right). Used for the "shark attack" feeding-time question ----- */
  shark(ctx, x, y, size, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    const wag = Math.sin(t * 5) * 0.22;

    const body = ctx.createLinearGradient(0, -30, 0, 30);
    body.addColorStop(0, '#5b7186');
    body.addColorStop(0.55, '#8197ab');
    body.addColorStop(0.56, '#e8eef3');
    body.addColorStop(1, '#cfd9e2');

    // tail
    ctx.save();
    ctx.translate(-70, 0);
    ctx.rotate(wag);
    ctx.fillStyle = '#5b7186';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-30, -38);
    ctx.lineTo(-18, 0);
    ctx.lineTo(-28, 26);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // dorsal and pectoral fins
    ctx.fillStyle = '#5b7186';
    ctx.beginPath();
    ctx.moveTo(-14, -20);
    ctx.lineTo(4, -52);
    ctx.lineTo(18, -18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, 12);
    ctx.lineTo(-10, 40);
    ctx.lineTo(28, 16);
    ctx.closePath();
    ctx.fill();

    // body (a long torpedo)
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(78, 2);
    ctx.quadraticCurveTo(60, -26, 0, -24);
    ctx.quadraticCurveTo(-50, -20, -72, 0);
    ctx.quadraticCurveTo(-50, 18, 0, 20);
    ctx.quadraticCurveTo(56, 22, 78, 2);
    ctx.fill();

    // gills, eye and a toothy grin
    ctx.strokeStyle = 'rgba(40,55,70,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(30 - i * 6, -8);
      ctx.quadraticCurveTo(26 - i * 6, 0, 30 - i * 6, 8);
      ctx.stroke();
    }
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(54, -7, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(55, -8, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b3a48';
    ctx.beginPath();
    ctx.moveTo(44, 9);
    ctx.quadraticCurveTo(60, 14, 72, 6);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(48 + i * 5, 10 + i * 0.3);
      ctx.lineTo(50 + i * 5, 14);
      ctx.lineTo(52 + i * 5, 10 + i * 0.1);
      ctx.fill();
    }
    ctx.restore();
  },

  /* ----- crab that scuttles sideways on the sand ----- */
  crab(ctx, x, y, size, t, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    color = color || '#ff5e3a';
    const step = Math.sin(t * 12);

    // legs (they move in two alternating groups)
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        const lift = (i % 2 === 0 ? step : -step) * 3;
        ctx.beginPath();
        ctx.moveTo(side * 10, 2 + i * 3);
        ctx.lineTo(side * 20, -2 + i * 4 + lift);
        ctx.lineTo(side * 25, 10 + i * 2);
        ctx.stroke();
      }
    }
    // claws (they snap open and shut)
    const snap = Math.abs(Math.sin(t * 3)) * 0.5;
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(side * 12, -6);
      ctx.lineTo(side * 18, -16);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.save();
      ctx.translate(side * 19, -19);
      ctx.beginPath();
      ctx.arc(0, 0, 6, -Math.PI / 2 - snap, Math.PI * 1.5 - 0.6 + snap);
      ctx.lineTo(0, 0);
      ctx.fill();
      ctx.restore();
    }
    // shell
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-4, -4, 7, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // eyes on stalks
    for (let side = -1; side <= 1; side += 2) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(side * 5, -9);
      ctx.lineTo(side * 6, -17);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(side * 6, -18, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(side * 6, -18, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  /* ----- octopus peeking out, with curling tentacles ----- */
  octopus(ctx, x, y, size, t, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    color = color || '#c56cf0';
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = -1.1 + i * 0.44;
      ctx.lineWidth = 6 - i % 2;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * 12, 10);
      let px = Math.sin(a) * 12, py = 10;
      for (let k = 1; k <= 6; k++) {
        px += Math.sin(a) * 5 + Math.sin(t * 2 + i + k * 0.8) * 3;
        py += 4.5;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    const breathe = 1 + Math.sin(t * 2) * 0.05;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, -6, 22 * breathe, 24 / breathe, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-10 + i * 6, -18 + (i % 2) * 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // sleepy-happy eyes
    const blink = (t % 5) > 4.85;
    for (let side = -1; side <= 1; side += 2) {
      if (blink) {
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(side * 8 - 4, 2);
        ctx.lineTo(side * 8 + 4, 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(side * 8, 2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(side * 8 + 1, 3, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  /* ----- manta ray gliding with flapping wings ----- */
  manta(ctx, x, y, size, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    const flap = Math.sin(t * 1.6) * 14;
    ctx.fillStyle = 'rgba(30, 60, 110, 0.55)';
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.quadraticCurveTo(10, -10 - flap, -20, -60 - flap);
    ctx.quadraticCurveTo(-10, -10, -30, 0);
    ctx.quadraticCurveTo(-10, 10, -20, 60 + flap);
    ctx.quadraticCurveTo(10, 10 + flap, 40, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 60, 110, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.quadraticCurveTo(-60, Math.sin(t * 3) * 8, -80, 0);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(10, 0, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /* ----- sea anemone: a clump of waving glowing tentacles ----- */
  anemone(ctx, x, y, size, t, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    for (let i = 0; i < 9; i++) {
      const a = -0.9 + i * 0.225;
      const sway = Math.sin(t * 2 + i * 0.6) * 0.25;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const ex = Math.sin(a + sway) * 26;
      const ey = -Math.cos(a + sway) * 30;
      ctx.quadraticCurveTo(ex * 0.3, ey * 0.7, ex, ey);
      ctx.stroke();
      ctx.fillStyle = '#fff6fb';
      ctx.beginPath();
      ctx.arc(ex, ey, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /* ----- a mossy rock on the sea floor ----- */
  rock(ctx, x, y, w, h, color) {
    ctx.save();
    ctx.translate(x, y);
    const g = ctx.createLinearGradient(0, -h, 0, 0);
    g.addColorStop(0, color || '#6f7f8f');
    g.addColorStop(1, '#3b4652');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.quadraticCurveTo(-w / 2, -h * 0.9, -w * 0.1, -h);
    ctx.quadraticCurveTo(w * 0.35, -h * 1.05, w / 2, -h * 0.3);
    ctx.lineTo(w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(80, 180, 110, 0.55)';                  // moss on top
    ctx.beginPath();
    ctx.ellipse(-w * 0.05, -h * 0.92, w * 0.28, h * 0.14, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /* ----- clam that opens to show a glowing pearl ----- */
  clam(ctx, x, y, size, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    const open = 0.25 + Math.max(0, Math.sin(t * 0.7)) * 0.45;
    ctx.fillStyle = '#e7a9c9';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 9, 0, 0, Math.PI);                    // bottom shell
    ctx.fill();
    // pearl
    const glow = ctx.createRadialGradient(0, -3, 1, 0, -3, 14);
    glow.addColorStop(0, 'rgba(255,255,255,' + (0.5 + open * 0.5) + ')');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-16, -18, 32, 30);
    ctx.fillStyle = '#fdf7ff';
    ctx.beginPath();
    ctx.arc(0, -3, 5, 0, Math.PI * 2);
    ctx.fill();
    // top shell, hinged at the back
    ctx.save();
    ctx.translate(-18, 0);
    ctx.rotate(-open);
    ctx.fillStyle = '#f3bcd8';
    ctx.beginPath();
    ctx.ellipse(18, 0, 20, 11, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,80,120,0.5)';
    ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(18 + i * 7, -10 + Math.abs(i) * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  },

  /* ----- treasure chest; open is 0 (closed) to 1 (wide open) ----- */
  chest(ctx, x, y, open, t) {
    ctx.save();
    ctx.translate(x, y);

    // golden glow coming out of the chest
    if (open > 0) {
      const glow = ctx.createRadialGradient(45, 10, 5, 45, 10, 80);
      glow.addColorStop(0, 'rgba(255,230,120,' + (0.55 + Math.sin(t * 3) * 0.15) * open + ')');
      glow.addColorStop(1, 'rgba(255,230,120,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-40, -70, 170, 150);
    }

    // box
    ctx.fillStyle = '#8d5524';
    ctx.fillRect(0, 20, 90, 45);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(0, 20, 90, 5);
    ctx.fillRect(10, 20, 7, 45);
    ctx.fillRect(73, 20, 7, 45);

    // coins inside
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(14 + i * 12, 20 - (i % 2) * 3, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // lid swings up around its back edge
    ctx.save();
    ctx.translate(0, 20);
    ctx.rotate(-open * 1.0);
    ctx.fillStyle = '#a56a2f';
    ctx.beginPath();
    ctx.ellipse(45, 0, 45, 24, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(38, -2, 14, 8);
    ctx.restore();
    ctx.restore();
  }
};
