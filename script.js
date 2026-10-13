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

// Matrix intro. Rezmason's digital rain (vendored in /matrix) fills the screen, then the
// page fades in over it, images land last, and the rain settles into a faint background.
// The page text is in the DOM the whole time; it is only transparent during the intro.
(function () {
  var root = document.documentElement;
  var done = function () { root.classList.add('intro-done'); };
  var RAIN_MS = 2200;   // how long the rain plays on its own before the page appears
  var IMAGE_DELAY = 700; // images start landing this long after the text begins to fade in

  function webgl() {
    try { return !!document.createElement('canvas').getContext('webgl'); } catch (e) { return false; }
  }

  // Images arrive last, one after another.
  [].forEach.call(document.querySelectorAll('.photo, .logo, .award img'), function (img, i) {
    img.style.transitionDelay = (IMAGE_DELAY + i * 90) + 'ms';
  });

  // Opened from disk, browsers block the rain's modules, so skip straight to the page.
  if (location.protocol === 'file:' || !webgl() ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return done();

  var small = window.innerWidth < 768;
  var params = new URLSearchParams({
    version: 'classic',
    skipIntro: 'true',
    suppressWarnings: 'true',
    numColumns: String(Math.max(24, Math.min(90, Math.round(window.innerWidth / 16)))),
    resolution: small ? '0.5' : '0.75',
    fps: small ? '30' : '60'
  });
  var frame = document.createElement('iframe');
  frame.className = 'matrix-rain';
  frame.title = 'Decorative digital rain';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.src = 'matrix/index.html?' + params.toString();
  document.body.insertBefore(frame, document.body.firstChild);

  var ended = false;
  // Keep a faint rain behind the page on larger screens in dark mode; drop it elsewhere to save battery.
  function settle() {
    var keep = !small && root.getAttribute('data-theme') !== 'light';
    frame.classList.toggle('gone', !keep);
    frame.classList.add('ambient');
  }
  function reveal() {
    if (ended) return;
    ended = true;
    done();
    settle();
  }

  var timer = setTimeout(reveal, RAIN_MS + 2000); // in case the rain never loads
  frame.addEventListener('load', function () {
    clearTimeout(timer);
    timer = setTimeout(reveal, RAIN_MS);
  });
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (type) {
    window.addEventListener(type, reveal, { once: true, passive: true });
  });
  document.addEventListener('themechange', function () { if (ended) settle(); else reveal(); });
})();
