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
  const images = [...page.querySelectorAll('img')].map((img) =>
    img.complete ? null : new Promise((done) => { img.onload = img.onerror = done; }),
  );
  const assets = Promise.all([document.fonts ? document.fonts.ready : null, ...images]);
  await Promise.race([assets, new Promise((done) => setTimeout(done, 2000))]);
  sweep.capture();
  setTimeout(() => sweep.sweep(1), 300);
}

start().catch((error) => {
  console.warn('Intro animation failed, showing the page directly.', error);
  reveal();
});
})();
