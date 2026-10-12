(function () {
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var targets = document.querySelectorAll('.decode');
  var buttons = document.querySelectorAll('[data-mode]');
  var WORD_RE = /[\p{L}\p{N}]/u;
  var MATRIX = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789';
  var DITHER = ['▓', '▒', '░'];

  function pick(s) { return s.charAt(Math.floor(Math.random() * s.length)); }
  function between(a, b) { return a + Math.random() * (b - a); }
  function sameClass(ch) {
    if (/[A-Z]/.test(ch)) return pick('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    if (/[a-z]/.test(ch)) return pick('abcdefghijklmnopqrstuvwxyz');
    if (/[0-9]/.test(ch)) return pick('0123456789');
    return ch;
  }

  // Each mode: interval (ms between renders), setup(word, ctx) to create per-char timing,
  // draw(word, elapsed) to paint, and a class added to each word span while running.
  var MODES = {
    sweep: {
      interval: 40, cls: 'sweep', duration: 2600, band: 0.24, trail: 0.3, angle: 18,
      ramp: ' .:-=+*#%@',
      setup: function (w) {
        var m = MODES.sweep, a = m.angle * Math.PI / 180;
        var vw = window.innerWidth, vh = window.innerHeight;
        var r = w.el.getBoundingClientRect();
        // Words outside the first screen skip the effect so the sweep stays quick.
        if (r.bottom < 0 || r.top > vh) { w.u = -9; w.max = 0; return; }
        var p = (r.left + r.width / 2) * Math.cos(a) + (r.top + r.height / 2) * Math.sin(a);
        w.u = Math.min(1, Math.max(0, p / (vw * Math.cos(a) + vh * Math.sin(a))));
        w.rs = w.text.split('').map(function () { return between(0.05, 0.55); });
        w.max = (w.u + m.band + m.trail) / (1 + m.band + m.trail) * m.duration;
      },
      draw: function (w, t) {
        var m = MODES.sweep, ramp = m.ramp, n = ramp.length;
        var lead = t / m.duration * (1 + m.band + m.trail), tail = lead - m.band;
        var out = '', glyphs = false, g = 1;
        if (w.u > lead) {
          out = w.text.replace(/./g, '\u00a0');
          g = 0;
        } else if (w.u < tail) {
          out = w.text;
          g = Math.max(0, 1 - (tail - w.u) / m.trail);
        } else {
          var q = (w.u - tail) / m.band; // 0 at the trailing edge, 1 at the leading edge
          for (var i = 0; i < w.text.length; i++) {
            var ch = w.text[i];
            if (q <= w.rs[i]) { out += ch; continue; }
            glyphs = true;
            if (q > 0.8 && Math.random() < (q - 0.8) * 3) { out += '\u00a0'; continue; }
            var level = Math.pow(1 - Math.abs(q - 0.55) * 1.8, 0.8) * (0.55 + 0.45 * Math.random());
            out += ramp.charAt(Math.max(1, Math.min(n - 1, Math.round(level * (n - 1)))));
          }
        }
        w.el.textContent = out;
        w.el.style.setProperty('--g', g.toFixed(2));
        w.el.classList.toggle('pixel', glyphs);
      }
    },
    matrix: {
      interval: 50, cls: 'scrambling',
      setup: function (w) {
        w.settle = w.text.split('').map(function () { return between(500, 2000); });
      },
      draw: function (w, t) {
        var out = '';
        for (var i = 0; i < w.text.length; i++) {
          var ch = w.text[i];
          out += t >= w.settle[i] || !WORD_RE.test(ch) ? ch : pick(MATRIX);
        }
        w.el.textContent = out;
      }
    },
    pixel: {
      interval: 50, cls: 'pixel scrambling', step: 110,
      setup: function (w) {
        w.settle = w.text.split('').map(function () { return between(0, 1300); });
        w.max = Math.max.apply(null, w.settle) + 4 * 110;
      },
      draw: function (w, t) {
        var out = '';
        for (var i = 0; i < w.text.length; i++) {
          var ch = w.text[i], local = t - w.settle[i];
          if (local < 0) out += '█';
          else {
            var stage = Math.floor(local / 110);
            out += stage >= DITHER.length ? ch : DITHER[stage];
          }
        }
        w.el.textContent = out;
        // Swap back to the real typeface as soon as the whole word is resolved.
        w.el.classList.toggle('pixel', t < w.max - 110);
        w.el.classList.toggle('scrambling', t < w.max - 110);
      },
      finishAt: function (w) { return w.max; }
    },
    type: {
      interval: 30, cls: 'caret', total: 2200,
      setup: function (w, ctx) {
        var len = ctx.totals.get(w.parent), base = ctx.bases.get(w);
        w.settle = w.text.split('').map(function (_, i) { return (base + i + 1) / len * MODES.type.total; });
        w.prev = w.text.split('').map(function (_, i) { return (base + i) / len * MODES.type.total; });
        w.max = w.settle[w.settle.length - 1];
      },
      draw: function (w, t) {
        var out = '';
        for (var i = 0; i < w.text.length; i++) {
          if (t >= w.settle[i]) out += w.text[i];
          else out += t >= w.prev[i] ? '▌' : ' ';
        }
        w.el.textContent = out;
      }
    },
    fade: {
      interval: 16, cls: '', dur: 700,
      setup: function (w) {
        w.delay = between(0, 1100);
        w.max = w.delay + MODES.fade.dur;
      },
      draw: function (w, t) {
        var p = Math.min(1, Math.max(0, (t - w.delay) / MODES.fade.dur));
        var e = 1 - Math.pow(1 - p, 3);
        w.el.style.opacity = e;
        w.el.style.transform = 'translateY(' + ((1 - e) * 12) + 'px)';
        w.el.style.filter = p < 1 ? 'blur(' + ((1 - e) * 6) + 'px)' : '';
      }
    },
    flap: {
      interval: 70, cls: '',
      setup: function (w) {
        w.settle = w.text.split('').map(function (_, i) { return 400 + i * 70 + between(0, 500); });
      },
      draw: function (w, t) {
        var out = '';
        for (var i = 0; i < w.text.length; i++) out += t >= w.settle[i] ? w.text[i] : sameClass(w.text[i]);
        w.el.textContent = out;
      }
    }
  };

  var words = [];
  var raf = 0;
  var current = 'sweep';
  try { var saved = localStorage.getItem('anim2'); if (saved && MODES[saved]) current = saved; } catch (e) {}

  function stop() {
    cancelAnimationFrame(raf);
    words.forEach(function (w) {
      if (w.el.parentNode) w.el.replaceWith(document.createTextNode(w.text));
    });
    targets.forEach(function (el) { el.normalize(); });
    words = [];
  }

  function wrap() {
    targets.forEach(function (el) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (node) {
        if (!node.nodeValue.trim()) return;
        var frag = document.createDocumentFragment();
        node.nodeValue.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(part));
          var span = document.createElement('span');
          span.className = 'w';
          span.textContent = part;
          frag.appendChild(span);
          words.push({ el: span, text: part, parent: el });
        });
        node.parentNode.replaceChild(frag, node);
      });
    });
  }

  function play(name) {
    stop();
    var mode = MODES[name];
    wrap();
    if (!words.length) return root.classList.add('ready');

    // Freeze every word at its real width so changing glyphs never reflow the page.
    words.forEach(function (w) { w.width = w.el.getBoundingClientRect().width; });

    var totals = new Map(), bases = new Map();
    words.forEach(function (w) {
      bases.set(w, totals.get(w.parent) || 0);
      totals.set(w.parent, (totals.get(w.parent) || 0) + w.text.length);
    });
    var ctx = { totals: totals, bases: bases };

    words.forEach(function (w) {
      w.el.style.width = w.width + 'px';
      w.el.style.display = 'inline-block';
      mode.setup(w, ctx);
      if (w.max === undefined) w.max = Math.max.apply(null, w.settle);
      if (mode.cls) mode.cls.split(' ').forEach(function (c) { w.el.classList.add(c); });
      w.finished = false;
    });
    render(0);
    root.classList.add('ready');

    var t0 = performance.now(), last = -Infinity;
    function frame(now) {
      var t = now - t0;
      if (t - last >= mode.interval) {
        last = t;
        if (!render(t)) return stop();
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function render(t) {
      var pending = 0;
      words.forEach(function (w) {
        if (w.finished) return;
        if (t >= w.max) {
          w.el.textContent = w.text;
          w.el.removeAttribute('style');
          w.el.className = 'w';
          w.finished = true;
          return;
        }
        pending++;
        mode.draw(w, t);
      });
      return pending;
    }
  }

  function select(name, replay) {
    current = name;
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === name)); });
    try { localStorage.setItem('anim2', name); } catch (e) {}
    if (replay) play(name);
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () { select(b.dataset.mode, true); });
  });
  var replay = document.querySelector('[data-replay]');
  if (replay) replay.addEventListener('click', function () { play(current); });

  select(current, false);
  if (reduced) root.classList.add('ready');
  else play(current);
})();
