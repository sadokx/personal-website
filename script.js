(function () {
  var root = document.documentElement;
  var reveal = function () { root.classList.add('ready'); };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return reveal();

  var GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789';
  var SETTLE_MIN = 500;    // earliest a character can lock in (ms)
  var SETTLE_SPAN = 1500;  // random spread added on top
  var FLICKER = 50;        // how often unrevealed characters change (ms)
  var WORD_RE = /[\p{L}\p{N}]/u;

  var targets = document.querySelectorAll('.decode');
  var words = [];

  // Wrap every word in a span so it can be frozen at its real width.
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
        words.push({ el: span, text: part });
      });
      node.parentNode.replaceChild(frag, node);
    });
  });
  if (!words.length) return reveal();

  // Measure first, then write, so layout never shifts while glyphs change.
  words.forEach(function (w) { w.width = w.el.getBoundingClientRect().width; });
  words.forEach(function (w) {
    w.el.style.width = w.width + 'px';
    w.settle = [];
    for (var i = 0; i < w.text.length; i++) w.settle.push(SETTLE_MIN + Math.random() * SETTLE_SPAN);
    w.max = Math.max.apply(null, w.settle);
    w.el.classList.add('scrambling');
  });
  render(0);
  reveal();

  function glyph() { return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length)); }

  function render(elapsed) {
    var pending = 0;
    words.forEach(function (w) {
      if (w.finished) return;
      if (elapsed >= w.max) {
        w.el.textContent = w.text;
        w.el.classList.remove('scrambling');
        w.finished = true;
        return;
      }
      pending++;
      var out = '';
      for (var i = 0; i < w.text.length; i++) {
        var ch = w.text[i];
        out += elapsed >= w.settle[i] || !WORD_RE.test(ch) ? ch : glyph();
      }
      w.el.textContent = out;
    });
    return pending;
  }

  var t0 = performance.now();
  var last = 0;
  function frame(now) {
    var elapsed = now - t0;
    if (elapsed - last >= FLICKER) {
      last = elapsed;
      if (!render(elapsed)) return cleanup();
    }
    requestAnimationFrame(frame);
  }

  // Unwrap the spans so the DOM ends up as plain text again.
  function cleanup() {
    targets.forEach(function (el) {
      el.querySelectorAll('.w').forEach(function (s) { s.replaceWith(document.createTextNode(s.textContent)); });
      el.normalize();
    });
  }

  requestAnimationFrame(frame);
})();
