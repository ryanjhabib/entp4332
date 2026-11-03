import { cssTime } from './dom.js';

// Text too long for its line, as on Eternitie's directory (LoopText in
// marksmenconnectdemo): the line fades out over its last 2em, and while its
// host (the compare details, a family card) is hovered it loops left like a
// ticker at 50px/s, a copy following 3em behind, its left edge fading in.
// Leaving, it eases back over the hover fade to whichever loop end is
// nearer (both read the same). Styles: .loop-line in style.css.

const PX_PER_S = 50;
const loops = new WeakMap();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Marks a line data-overflow while its text is wider than it, which turns its
// edge fade on. Watches both: the line resizes with the layout, the text when
// its font loads.
const overflowObserver = new ResizeObserver((entries) => {
  for (const { target } of entries) {
    const line = target.closest('.loop-line');
    const text = line?.firstElementChild.firstElementChild;
    if (line) line.toggleAttribute('data-overflow', text.offsetWidth > line.clientWidth);
  }
});

// A line element showing `text`, ready to loop.
export function loopLine(text, className = '') {
  const line = document.createElement('span');
  line.className = `${className} loop-line`.trim();
  const track = document.createElement('span');
  track.className = 'loop-track';
  const main = document.createElement('span');
  main.textContent = text;
  const copy = document.createElement('span');
  copy.className = 'loop-copy';
  copy.setAttribute('aria-hidden', 'true');
  copy.textContent = text;
  track.append(main, copy);
  line.append(track);
  overflowObserver.observe(line);
  overflowObserver.observe(main);
  return line;
}

// The hover fade's duration and easing, from the page's tokens.
function fadeTiming(element) {
  return { duration: cssTime(element, '--hover-fade'), easing: getComputedStyle(element).getPropertyValue('--ease-fade').trim() };
}

// One loop: the text plus the gap to its copy (the copy's left padding).
const loopLength = (track) => track.firstElementChild.offsetWidth + parseFloat(getComputedStyle(track.lastElementChild).paddingLeft);

function start(line) {
  const track = line.firstElementChild;
  if (track.firstElementChild.offsetWidth <= line.clientWidth) return;
  loops.get(line)?.cancel();
  line.setAttribute('data-loop', '');
  const loop = loopLength(track);
  loops.set(line, track.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-loop}px)` }], {
    duration: (loop / PX_PER_S) * 1000,
    iterations: Infinity,
  }));
}

function stop(line) {
  const running = loops.get(line);
  if (!running) return;
  loops.delete(line);
  const track = line.firstElementChild;
  const loop = loopLength(track);
  const x = new DOMMatrix(getComputedStyle(track).transform).m41;
  running.cancel();
  const back = track.animate([{ transform: `translateX(${x}px)` }, { transform: `translateX(${x < -loop / 2 ? -loop : 0}px)` }], fadeTiming(line));
  back.finished.then(() => { if (!loops.has(line)) line.removeAttribute('data-loop'); }).catch(() => {});
}

// Hovering `host` loops every line in it that doesn't fit.
export function loopOnHover(host) {
  host.classList.add('loop-host');
  host.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' || reducedMotion.matches) return;
    host.querySelectorAll('.loop-line').forEach(start);
  });
  host.addEventListener('pointerleave', () => host.querySelectorAll('.loop-line').forEach(stop));
}
