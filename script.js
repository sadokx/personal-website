(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789';
  var DURATION = 650;
  var MAX_DELAY = 1400;
  var FLICKER = 60;

  var words = [];
  var targets = document.querySelectorAll('.decode');

  // Pass 1: wrap every word in a span.
  targets.forEach(function (el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (!node.nodeValue.trim()) return;
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else {
          var span = document.createElement('span');
          span.className = 'w';
          span.textContent = part;
          frag.appendChild(span);
          words.push({ el: span, text: part });
        }
      });
      node.parentNode.replaceChild(frag, node);
    });
  });
  if (!words.length) return;

  // Pass 2: freeze each word at its real width so scrambled glyphs never reflow the page.
  words.forEach(function (w) { w.width = w.el.getBoundingClientRect().width; });
  var count = words.length;
  var step = Math.min(8, MAX_DELAY / count);
  var start = performance.now() + 150;
  words.forEach(function (w, i) {
    w.el.style.width = w.width + 'px';
    w.start = start + i * step;
    w.last = 0;
    w.el.classList.add('scrambling');
    w.el.textContent = scramble(w.text, 0);
  });

  function rand() { return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length)); }
  function scramble(text, revealed) {
    var out = text.slice(0, revealed);
    for (var i = revealed; i < text.length; i++) out += /[\p{L}\p{N}]/u.test(text[i]) ? rand() : text[i];
    return out;
  }

  var done = 0;
  function frame(now) {
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.finished) continue;
      var p = (now - w.start) / DURATION;
      if (p < 0) continue;
      if (p >= 1) {
        w.el.textContent = w.text;
        w.el.classList.remove('scrambling');
        w.el.style.width = '';
        w.finished = true;
        done++;
        continue;
      }
      if (now - w.last >= FLICKER) {
        w.last = now;
        w.el.textContent = scramble(w.text, Math.floor(p * w.text.length));
      }
    }
    if (done < words.length) requestAnimationFrame(frame);
    else cleanup();
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
