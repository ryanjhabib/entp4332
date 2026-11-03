// The app's cursor on desktop, the one from Mercy Stays Warm: a thin + that
// follows the mouse, white inverted against what's under it (difference),
// so it reads dark on light and light on dark. 10px in general, 20px over
// anything clickable, a 20px upright line over text fields, and a 170px +
// over a compare frame (click: the versions full size), which folds to a −
// there (click: back). MSW's Safari workarounds aren't needed: the app is
// Chrome only. In screen fades it stays on top, live (style.css).

const CLICKABLE = 'a[href], button:not(:disabled), [role="button"], [role="option"], label, .clears > li';
const TEXT_FIELD = 'input[type="text"], textarea';

// 'zoom' and 'zoomed' come from a data-cursor attribute.
function modeFor(target) {
  if (!target) return 'plain';
  if (target.closest(TEXT_FIELD)) return 'text';
  const marked = target.closest('[data-cursor]');
  if (marked) return marked.dataset.cursor;
  return target.closest(CLICKABLE) ? 'link' : 'plain';
}

export function setUpCursor() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'cursor-layer';
  layer.setAttribute('aria-hidden', 'true');
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  cursor.dataset.mode = 'plain';
  layer.append(cursor);
  document.body.append(layer);

  let x = 0;
  let y = 0;
  let target = null;
  let frame = 0;

  // Moves at most once a frame, however many mouse events arrive.
  const draw = () => {
    frame = 0;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    cursor.classList.add('is-shown');
    cursor.dataset.mode = modeFor(target);
  };

  // What's under a still mouse changes too: a click or key that opens or
  // closes something (Space, a frame), or scrolling.
  const recheck = () => {
    if (frame || !cursor.classList.contains('is-shown')) return;
    frame = requestAnimationFrame(() => {
      target = document.elementFromPoint(x, y);
      draw();
    });
  };

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    x = event.clientX;
    y = event.clientY;
    target = event.target;
    if (!frame) frame = requestAnimationFrame(draw);
  }, { passive: true });
  document.addEventListener('click', recheck, true);
  document.addEventListener('keydown', recheck, true);
  document.addEventListener('scroll', recheck, { passive: true, capture: true });
  document.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget) cursor.classList.remove('is-shown');
  });
  document.documentElement.classList.add('has-cursor');
}
