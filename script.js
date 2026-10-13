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

// Intro: every visible character of the page slips out of a streak of Matrix code a few
// lines above its spot, cycling glyphs as it falls, and locks into its real position.
// Then the images and bullets fade in. The real text stays in the DOM (transparent) the
// whole time, so crawlers and screen readers always see it.
(function () {
  var root = document.documentElement;
  var page = document.querySelector('.page');
  var ready = function () { root.classList.add('rain-ready'); };
  var done = function () { root.classList.add('rain-ready', 'intro-done'); };
  if (!page || !window.requestAnimationFrame) return done();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return done();


  // Mirrored half-width katakana, like the film, plus a few digits and symbols.
  var KANA = 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ';
  var PLAIN = '012345789Z:."=*+-<>¦|';
  var GLYPH_COUNT = KANA.length + PLAIN.length;
  var GLYPH_FONT = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Noto Sans JP", "MS Gothic", monospace';
  var TEXT = 'h1, h2, h3, p, li';

  var small = window.innerWidth < 600;
  var CELL = small ? 15 : 19;           // glyph size of the falling code, px
  var SPEED = [6, 12];                  // cells per second
  var SLIP = [0, 1800];                 // ms window in which page characters slip out of the code (starts immediately)
  var TRAIL = small ? [6, 14] : [8, 20]; // cells per streak
  var WHITE_HEADS = 0.3;                // share of streaks with a white-hot head; the rest stay green
  var SLIP_CELLS = [2, 7];              // how many cells above its spot a character emerges

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randGlyph() { return Math.floor(Math.random() * GLYPH_COUNT); }

  var light = root.getAttribute('data-theme') === 'light';
  var COLORS = light
    ? { head: '#063d16', near: '#0b6b2a', body: '#16893c' }
    : { head: '#e9ffec', near: '#9dffb6', body: '#1fe25a' };

  // Pre-render every glyph once per color, so drawing is just drawImage.
  var ATLAS_CELL = 64;
  function makeAtlas(color) {
    var c = document.createElement('canvas');
    c.width = ATLAS_CELL * GLYPH_COUNT;
    c.height = ATLAS_CELL;
    var ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = '600 ' + Math.round(ATLAS_CELL * 0.86) + 'px ' + GLYPH_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < GLYPH_COUNT; i++) {
      var cx = i * ATLAS_CELL + ATLAS_CELL / 2, cy = ATLAS_CELL / 2;
      if (i < KANA.length) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(-1, 1);
        ctx.fillText(KANA[i], 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(PLAIN[i - KANA.length], cx, cy);
      }
    }
    return c;
  }

  function fontsReady() {
    if (!document.fonts) return Promise.resolve();
    return Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1000); })]);
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

  // Where the browser draws the baseline: a zero-size inline-block sits exactly on it.
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
          info = { font: s.fontStyle + ' ' + s.fontWeight + ' ' + s.fontSize + ' ' + s.fontFamily, size: parseFloat(s.fontSize), color: s.color, offset: null };
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
          chars.push({ ch: text[i], x: r.left, w: r.width, top: r.top, h: r.height, base: r.top + info.offset, size: info.size, font: info.font, color: info.color });
        }
      });
    });
    return chars;
  }

  // Canvases sized to the layout viewport (excluding the scrollbar), or glyphs drift sideways.
  function makeCanvas(w, h, dpr, z) {
    var c = document.createElement('canvas');
    c.className = 'rain';
    c.setAttribute('aria-hidden', 'true');
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    c.style.zIndex = z;
    document.body.appendChild(c);
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { el: c, ctx: ctx };
  }

  function run() {
    var blocks = textBlocks();
    var chars = measure(blocks);
    var W = document.documentElement.clientWidth;
    var H = document.documentElement.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var atlas = { head: makeAtlas(COLORS.head), near: makeAtlas(COLORS.near), body: makeAtlas(COLORS.body) };
    blocks.forEach(function (b) { b.classList.add('rain-hide'); });
    var rain = makeCanvas(W, H, dpr, 4);    // falling streaks and glow
    var landed = makeCanvas(W, H, dpr, 5);  // page characters that have locked into place
    landed.ctx.textBaseline = 'alphabetic';

    // Cheap bloom: shrink the rain frame, then add it back stretched, which blurs it.
    var bloom = light ? null : document.createElement('canvas');
    if (bloom) {
      bloom.width = Math.max(1, Math.round(W / 4));
      bloom.height = Math.max(1, Math.round(H / 4));
    }
    var bloomCtx = bloom && bloom.getContext('2d');

    function glyph(set, index, cx, cy, size, alpha) {
      if (alpha <= 0.02) return;
      rain.ctx.globalAlpha = alpha > 1 ? 1 : alpha;
      rain.ctx.drawImage(set, index * ATLAS_CELL, 0, ATLAS_CELL, ATLAS_CELL, cx - size / 2, cy - size / 2, size, size);
    }

    // Each character is a streak of code that slips in a few cells above its spot and only
    // turns into the real character, at its real size, when it lands.
    chars.forEach(function (c) {
      c.cx = c.x + c.w / 2;
      c.cy = c.base - c.size * 0.35;
      c.start = rand(SLIP[0], SLIP[1]);
      c.steps = Math.round(rand(SLIP_CELLS[0], SLIP_CELLS[1] + 1));
      c.stepMs = 1000 / rand(SPEED[0], SPEED[1]);
      c.landAt = c.start + c.steps * c.stepMs;
      // Letters sit densely packed, so their streaks are kept short and soft.
      c.trail = Math.round(rand(TRAIL[0], TRAIL[1]) * 0.5);
      c.white = Math.random() < WHITE_HEADS;
      c.glyphs = [];
      for (var j = 0; j <= c.trail; j++) c.glyphs.push(randGlyph());
      c.step = -1;
      c.done = false;
    });
    var lastLand = chars.reduce(function (m, c) { return Math.max(m, c.landAt); }, SLIP[1]);
    var END = lastLand + 800; // the last trail has dissolved

    function drawChars(t) {
      for (var i = 0; i < chars.length; i++) {
        var c = chars[i];
        var local = t - c.start;
        if (local < 0) continue;
        var since = t - c.landAt;
        var cellsAbove = 0;
        if (since < 0) {
          var step = Math.floor(local / c.stepMs);
          if (step !== c.step) {
            c.glyphs.unshift(randGlyph());
            c.glyphs.pop();
            c.step = step;
          }
          cellsAbove = c.steps - step;
        } else {
          if (!c.done) {
            c.done = true;
            landed.ctx.font = c.font;
            landed.ctx.fillStyle = c.color;
            landed.ctx.fillText(c.ch, c.x, c.base);
          }
          if (since > 800) continue;
        }
        var headY = c.cy - cellsAbove * CELL;
        var emerge = Math.min(1, local / 300);           // fades in out of the code instead of popping
        var fade = since < 0 ? emerge : 1 - since / 800; // trail dissolves after landing
        for (var j = c.trail; j >= 1; j--) {
          var y = headY - j * CELL;
          if (y < -CELL) continue;
          if (Math.random() < 0.012) c.glyphs[j] = randGlyph();
          var a = Math.pow(1 - j / (c.trail + 1), 0.8) * 0.5 * fade;
          glyph(j === 1 ? atlas.near : atlas.body, c.glyphs[j], c.cx, y, CELL, a);
        }
        if (since < 0) {
          if (Math.random() < 0.08) c.glyphs[0] = randGlyph();
          glyph(c.white ? atlas.head : atlas.near, c.glyphs[0], c.cx, headY, CELL, emerge);
        } else {
          // Landing flash under the settled character; the bloom turns it into a glow.
          rain.ctx.globalAlpha = Math.max(0, 1 - since / 500);
          rain.ctx.font = c.font;
          rain.ctx.fillStyle = COLORS.near;
          rain.ctx.fillText(c.ch, c.x, c.base);
        }
      }
    }

    var t0 = performance.now();
    var raf = 0;
    var finished = false;
    var imagesShown = false;
    rain.ctx.textBaseline = 'alphabetic';

    function frame(now) {
      var t = now - t0;
      var ctx = rain.ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      drawChars(t);

      if (bloomCtx) {
        bloomCtx.clearRect(0, 0, bloom.width, bloom.height);
        bloomCtx.drawImage(rain.el, 0, 0, bloom.width, bloom.height);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.85;
        ctx.drawImage(bloom, 0, 0, W, H);
      }
      ctx.globalAlpha = 1;

      if (!imagesShown && t >= lastLand) {
        imagesShown = true;
        root.classList.add('intro-done');
      }
      if (t >= END) return finish();
      raf = requestAnimationFrame(frame);
    }

    // Swap the real text back in and remove the canvases.
    function finish() {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', finish);
      document.removeEventListener('themechange', finish);
      blocks.forEach(function (b) { b.classList.remove('rain-hide'); });
      root.classList.add('intro-done');
      rain.el.remove();
      landed.el.remove();
    }

    // Positions are measured once, so a real scroll, a width change or a theme change ends the
    // intro early. Phones fire small scroll and resize events on their own (pull-to-refresh
    // bounce, the address bar sliding in and out), which must not count.
    var startY = window.scrollY;
    function onScroll() {
      if (window.scrollY >= 0 && Math.abs(window.scrollY - startY) > 12) finish();
    }
    function onResize() {
      if (document.documentElement.clientWidth !== W) finish();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', finish);
    document.addEventListener('themechange', finish);
    // Safety net: if frames get throttled, still end on time.
    var timer = setTimeout(finish, END + 1500);

    ready();
    raf = requestAnimationFrame(frame);
  }

  fontsReady().then(run).catch(function (error) {
    console.warn('Intro animation failed, showing the page directly.', error);
    [].forEach.call(document.querySelectorAll('.rain-hide'), function (b) { b.classList.remove('rain-hide'); });
    [].forEach.call(document.querySelectorAll('canvas.rain'), function (c) { c.remove(); });
    done();
  });
})();
