// Theme toggle. Night (Matrix) is the default; the choice is remembered per browser.
(function () {
  var root = document.documentElement;
  var button = document.querySelector('.theme-toggle');
  if (!button) return;
  function label() {
    var light = root.getAttribute('data-theme') === 'light';
    button.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
  }
  label();
  button.addEventListener('click', function () {
    var light = root.getAttribute('data-theme') !== 'light';
    if (light) root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
    try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch (e) {}
    label();
    document.dispatchEvent(new Event('themechange'));
  });
})();

// Matrix rain intro. Every visible character of the page falls down its own column,
// cycling through glyphs, and locks into its real position. The real text stays in the
// DOM the whole time (transparent), so the page stays readable to crawlers and
// assistive tech, and it is swapped back in once the rain settles.
(function () {
  var root = document.documentElement;
  var page = document.querySelector('.page');
  var ready = function () { root.classList.add('rain-ready'); };
  if (!page || !window.requestAnimationFrame) return ready();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return ready();

  var GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789Z:.=*+-<>';
  var TEXT = 'h1, h2, h3, p, li';
  var small = window.innerWidth < 600;
  var DELAY = 900;              // ms spread of start times, so columns fall concurrently
  var SPEED = [650, 1400];      // px per second
  var TRAIL = small ? [3, 7] : [4, 12];
  var STREAKS = 0.4;            // share of characters with a long trail
  var FLASH = 280;              // ms the landed character glows before settling
  var FADE = 420;               // ms the trail takes to fade after landing

  function rand(a, b) { return a + Math.random() * (b - a); }
  function glyph() { return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length)); }

  function fontsReady() {
    if (!document.fonts) return Promise.resolve();
    var load = Promise.all(['400', '600', '700'].map(function (w) { return document.fonts.load(w + ' 16px Inter'); }));
    return Promise.race([load, new Promise(function (done) { setTimeout(done, 1000); })]);
  }

  // Text blocks on the first screen, without nesting duplicates.
  function textBlocks() {
    var vh = window.innerHeight;
    var els = [].slice.call(page.querySelectorAll(TEXT)).filter(function (el) {
      var r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < vh;
    });
    var set = new Set(els);
    return els.filter(function (el) {
      for (var p = el.parentElement; p && p !== page; p = p.parentElement) if (set.has(p)) return false;
      return true;
    });
  }

  // Where the browser draws the baseline of a line, relative to that line's character boxes.
  // A zero-size inline-block sits exactly on the baseline, so its bottom edge is the baseline.
  function baselineOffset(node, i, charTop) {
    var marker = document.createElement('span');
    marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    var after = node.splitText(i);
    node.parentNode.insertBefore(marker, after);
    var offset = marker.getBoundingClientRect().bottom - charTop;
    marker.remove();
    node.appendData(after.nodeValue);
    after.remove();
    return offset;
  }

  // One entry per visible character, with its exact box, baseline, font and color.
  function measure(blocks) {
    var vh = window.innerHeight;
    var range = document.createRange();
    var styles = new Map();
    var chars = [];
    blocks.forEach(function (block) {
      var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      var nodes = [];
      var node;
      while ((node = walker.nextNode())) nodes.push(node);
      nodes.forEach(function (node) {
        var parent = node.parentElement;
        var info = styles.get(parent);
        if (!info) {
          var s = getComputedStyle(parent);
          info = { font: s.fontStyle + ' ' + s.fontWeight + ' ' + s.fontSize + ' ' + s.fontFamily, color: s.color, offset: null };
          styles.set(parent, info);
        }
        var text = node.nodeValue;
        for (var i = 0; i < text.length; i++) {
          if (/\s/.test(text[i])) continue;
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          var r = range.getBoundingClientRect();
          if (!r.width || r.bottom < 0 || r.top > vh) continue;
          if (info.offset === null) {
            info.offset = baselineOffset(node, i, r.top);
            text = node.nodeValue;
          }
          chars.push({ ch: text[i], x: r.left, top: r.top, h: r.height, base: r.top + info.offset, font: info.font, color: info.color });
        }
      });
    });
    return chars;
  }

  function makeCanvas(dpr) {
    var c = document.createElement('canvas');
    c.className = 'rain';
    c.setAttribute('aria-hidden', 'true');
    // Size to the layout viewport (excludes the scrollbar), or glyphs drift sideways.
    var w = document.documentElement.clientWidth, h = document.documentElement.clientHeight;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    document.body.appendChild(c);
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textBaseline = 'alphabetic';
    return { el: c, ctx: ctx };
  }

  function run() {
    var blocks = textBlocks();
    var chars = measure(blocks);
    if (!chars.length) return ready();

    var css = getComputedStyle(root);
    var HEAD = css.getPropertyValue('--rain-head').trim() || '#2f5bff';
    var TAIL = css.getPropertyValue('--rain-tail').trim() || '#6f8cff';
    var vh = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    blocks.forEach(function (b) { b.classList.add('rain-hide'); });
    var landed = makeCanvas(dpr);  // settled characters, drawn once each
    var rain = makeCanvas(dpr);    // falling heads and trails, redrawn every frame

    chars.sort(function (a, b) { return a.font < b.font ? -1 : a.font > b.font ? 1 : 0; });
    chars.forEach(function (c) {
      c.cell = Math.max(c.h, 10);
      c.delay = Math.random() * DELAY;
      c.stepMs = (c.cell / rand(SPEED[0], SPEED[1])) * 1000;
      c.steps = Math.ceil((rand(0.25, 0.95) * vh + 40) / c.cell);
      c.landAt = c.delay + c.steps * c.stepMs;
      // Only some characters drag a long streak; the rest fall as a lone glyph or a short tail.
      c.trail = Math.random() < STREAKS ? Math.round(rand(TRAIL[0], TRAIL[1])) : Math.round(rand(0, 2));
      // Some columns burn bright, others stay faint, like the film's code.
      c.dim = Math.random() < 0.3 ? rand(0.25, 0.5) : rand(0.7, 1);
      c.glyphs = [];
      for (var j = 0; j <= c.trail; j++) c.glyphs.push(glyph());
      c.step = -1;
      c.done = false;
    });

    var t0 = performance.now();
    var raf = 0;
    var finished = false;

    function draw(now) {
      var t = now - t0;
      var ctx = rain.ctx;
      ctx.clearRect(0, 0, document.documentElement.clientWidth, vh);
      var font = '';
      var active = 0;

      for (var i = 0; i < chars.length; i++) {
        var c = chars[i];
        var local = t - c.delay;
        if (local < 0) { active++; continue; }

        var since = t - c.landAt; // > 0 once the character has landed
        var cellsAbove;
        if (since < 0) {
          var step = Math.floor(local / c.stepMs);
          if (step !== c.step) {
            // The head writes a new glyph each cell; the trail keeps what was written.
            c.glyphs.unshift(glyph());
            c.glyphs.pop();
            c.step = step;
          }
          cellsAbove = c.steps - step;
        } else {
          cellsAbove = 0;
          if (!c.done) {
            c.done = true;
            landed.ctx.font = c.font;
            landed.ctx.fillStyle = c.color;
            landed.ctx.fillText(c.ch, c.x, c.base);
          }
          if (since > Math.max(FADE, FLASH)) continue;
        }
        active++;

        if (font !== c.font) { ctx.font = c.font; font = c.font; }
        var headY = c.base - cellsAbove * c.cell;
        var fade = since < 0 ? 1 : 1 - since / FADE;

        // Trail: fades toward the top, with glyphs that keep flickering.
        ctx.fillStyle = TAIL;
        for (var j = 1; j <= c.trail; j++) {
          var y = headY - j * c.cell;
          if (y < -c.cell) break;
          if (Math.random() < 0.04) c.glyphs[j] = glyph();
          var a = c.dim * Math.pow(1 - j / (c.trail + 1), 1.6) * 0.7 * fade;
          if (a <= 0.01) continue;
          ctx.globalAlpha = a;
          ctx.fillText(c.glyphs[j], c.x, y);
        }

        // Head: a bright, changing glyph while falling, then the real character glowing as it locks.
        ctx.fillStyle = HEAD;
        if (since < 0) {
          if (Math.random() < 0.25) c.glyphs[0] = glyph();
          ctx.globalAlpha = Math.min(1, c.dim + 0.3);
          ctx.fillText(c.glyphs[0], c.x, headY);
        } else if (since < FLASH) {
          ctx.globalAlpha = 1 - since / FLASH;
          ctx.fillText(c.ch, c.x, c.base);
        }
      }
      ctx.globalAlpha = 1;

      if (active) raf = requestAnimationFrame(draw);
      else finish();
    }

    // Swap the real text back in and fade the canvases away.
    function finish() {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('scroll', finish);
      window.removeEventListener('resize', finish);
      document.removeEventListener('visibilitychange', finish);
      document.removeEventListener('themechange', finish);
      blocks.forEach(function (b) { b.classList.remove('rain-hide'); });
      landed.el.remove();
      rain.el.remove();
    }

    // Positions are measured once, so any scroll or resize ends the intro early.
    window.addEventListener('scroll', finish, { passive: true });
    window.addEventListener('resize', finish);
    document.addEventListener('visibilitychange', finish);
    document.addEventListener('themechange', finish);

    // Safety net: if frames get throttled, still end on time instead of leaving text hidden.
    var lastLand = Math.max.apply(null, chars.map(function (c) { return c.landAt; }));
    var timer = setTimeout(finish, lastLand + Math.max(FADE, FLASH) + 600);

    ready();
    raf = requestAnimationFrame(draw);
  }

  fontsReady().then(run).catch(function (error) {
    console.warn('Intro animation failed, showing the page directly.', error);
    [].forEach.call(document.querySelectorAll('.rain-hide'), function (b) { b.classList.remove('rain-hide'); });
    [].forEach.call(document.querySelectorAll('canvas.rain'), function (c) { c.remove(); });
    ready();
  });
})();
