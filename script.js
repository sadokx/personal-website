(function () {
const { createAsciiSweep, supportsHtmlInCanvas } = window.CanvasUIAsciiSweep;

const root = document.documentElement;
const page = document.querySelector('.page');
const reveal = () => root.classList.add('ready');

// The sweep swaps between two stacked panels: an empty one, then the real page.
// With Chrome's HTML-in-Canvas flag the panels live inside <canvas layoutsubtree>.
// Without it, the engine snapshots the DOM itself and runs the same shader.
function buildStage() {
  const native = supportsHtmlInCanvas();
  const stage = document.createElement('div');
  stage.className = 'stage';

  const makeSlot = (child) => {
    const content = document.createElement('div');
    const source = document.createElement('canvas');
    if (child) content.append(child);
    if (native) {
      source.setAttribute('layoutsubtree', 'true');
      Object.assign(source.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
      Object.assign(content.style, { position: 'relative', width: '100%', height: '100%', overflow: 'auto' });
      source.append(content);
      stage.append(source);
    } else {
      source.style.display = 'none';
      Object.assign(content.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', overflow: 'auto' });
      stage.append(source, content);
    }
    return { source, content };
  };

  const slots = [makeSlot(null), makeSlot(page)];

  const output = document.createElement('canvas');
  output.setAttribute('aria-hidden', 'true');
  Object.assign(output.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '1', pointerEvents: 'none',
  });
  stage.append(output);

  return { stage, slots, output };
}

const loaded = (img) =>
  img.complete ? null : new Promise((done) => { img.onload = img.onerror = done; });

function loadFonts() {
  if (!document.fonts) return null;
  return Promise.all([document.fonts.load('400 16px Inter'), document.fonts.load('600 16px Inter'), document.fonts.load('700 16px Inter')]);
}

// Opened straight from disk, browsers treat every local image as cross-origin, so the
// intro cannot snapshot them. Swap in inlined copies, which are always readable.
async function loadImages() {
  const imgs = [...page.querySelectorAll('img')];
  if (location.protocol === 'file:') {
    await new Promise((done) => {
      const script = document.createElement('script');
      script.src = 'assets/inline-images.js';
      script.onload = script.onerror = done;
      document.head.append(script);
    });
    const inline = window.INLINE_IMAGES || {};
    imgs.forEach((img) => {
      const data = inline[img.getAttribute('src')];
      if (data) img.src = data;
    });
  }
  return Promise.all(imgs.map(loaded));
}

async function start() {
  const { stage, slots, output } = buildStage();
  root.classList.add('stage-on');
  document.body.prepend(stage);

  const sweep = createAsciiSweep({ slots, output }, { color: '#5b7cff' });
  if (!sweep) {
    // No WebGL2: show the page without the effect.
    stage.replaceWith(page);
    root.classList.remove('stage-on');
    return reveal();
  }
  reveal();

  // Let fonts and images settle so the captured panels match the final page.
  const assets = Promise.all([loadFonts(), loadImages()]);
  await Promise.race([assets, new Promise((done) => setTimeout(done, 1500))]);
  sweep.capture();
  setTimeout(() => sweep.sweep(1), 120);
}

start().catch((error) => {
  console.warn('Intro animation failed, showing the page directly.', error);
  reveal();
});
})();
