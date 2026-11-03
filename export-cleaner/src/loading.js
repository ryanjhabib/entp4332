import { $ } from './dom.js';

const FACTS = [
  'A bat’s wing, a dolphin’s flipper, and a human hand share the same underlying skeletal plan.',
  'Broccoli, kale, cauliflower, and Brussels sprouts are all the same species.',
  'Mushrooms are more closely related to animals than to plants.',
  'Octopuses and humans evolved camera-like eyes completely independently.',
  'Some euphorbias look almost exactly like cacti, but the two evolved that shape independently.',
];
const SCAN_MESSAGES = ['Scanning for similarities', 'Finding patterns', 'Comparing your versions', 'Tracing the details'];
const FACT_INTERVAL = 20_000;
const MESSAGE_INTERVAL = 8_000;
const DOT_INTERVAL = 600;
const PROGRESS_DURATION = 180;

// Reuse the intro's identity so the wordmark and copy stay identical.
$('#loading').prepend($('.entry-header').cloneNode(true));

let frame = 0;
let timers = [];
let displayed = 0;
let target = 0;
let from = 0;
let tweenStarted = 0;
let scanStarted = 0;
let phase = '';
let message = 0;
let finish = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// The start screen's rule and estimate line show the same progress until the
// loading screen takes over.
function paint() {
  $('#loading-percent').textContent = `${Math.floor(displayed)}%`;
  for (const fill of document.querySelectorAll('.loading-fill')) fill.style.transform = `scaleX(${displayed / 100})`;
  $('#loading-progress').setAttribute('aria-valuenow', Math.floor(displayed));
}

function showEta(text) {
  $('#loading-eta').textContent = $('#start-estimate').textContent = text;
}

function tick(now) {
  frame = 0;
  const elapsed = reducedMotion.matches ? 1 : Math.min(1, (now - tweenStarted) / PROGRESS_DURATION);
  displayed = elapsed === 1 ? target : from + (target - from) * elapsed;
  paint();
  if (elapsed < 1) frame = requestAnimationFrame(tick);
  else if (finish) { const resolve = finish; finish = null; resolve(); }
}

export function updateLoading(percent, nextPhase) {
  if (nextPhase) {
    phase = nextPhase;
    $('#loading-phase').textContent = phase;
  }
  const next = Math.max(target, Math.min(100, percent));
  if (next === target) return;
  from = displayed;
  target = next;
  tweenStarted = performance.now();
  if (!frame) frame = requestAnimationFrame(tick);
}

export function stopLoading() {
  cancelAnimationFrame(frame);
  frame = 0;
  for (const timer of timers) clearInterval(timer);
  timers = [];
}

export function startLoading() {
  stopLoading();
  displayed = target = from = 0;
  scanStarted = 0;
  message = 0;
  phase = 'Opening your folder';
  $('#loading-phase').textContent = phase;
  showEta('Estimating time remaining');
  $('#loading-retry').hidden = true;
  $('#loading-dots').textContent = reducedMotion.matches ? '...' : '.';
  $('#loading-fact').textContent = FACTS[0];
  paint();
  let dots = 1;
  if (!reducedMotion.matches) timers.push(setInterval(() => {
    dots = dots % 3 + 1;
    $('#loading-dots').textContent = '.'.repeat(dots);
  }, DOT_INTERVAL));
  timers.push(setInterval(() => {
    if (!scanStarted) return;
    message = (message + 1) % SCAN_MESSAGES.length;
    updateLoading(target, SCAN_MESSAGES[message]);
  }, MESSAGE_INTERVAL));
  if (FACTS.length > 1) {
    let fact = 0;
    timers.push(setInterval(() => {
      fact = (fact + 1) % FACTS.length;
      $('#loading-fact').textContent = FACTS[fact];
    }, FACT_INTERVAL));
  }
}

export function startScan() {
  scanStarted = performance.now();
  updateLoading(15, SCAN_MESSAGES[0]);
}

export function scannedFile(done, total) {
  updateLoading(15 + 83 * done / Math.max(1, total));
  if (done < 2) return;
  const seconds = (performance.now() - scanStarted) / done * (total - done) / 1000;
  showEta(seconds < 60
    ? 'Less than a minute remains'
    : `Approximately ${Math.ceil(seconds / 60)} min. ${Math.ceil(seconds / 60) === 1 ? 'remains' : 'remain'}`);
}

export async function finishLoading() {
  scanStarted = 0;
  showEta('Ready');
  updateLoading(100, 'Your versions are ready');
  if (displayed < 100) await new Promise(resolve => { finish = resolve; });
  stopLoading();
}

export function failLoading(message) {
  stopLoading();
  scanStarted = 0;
  $('#loading-phase').textContent = 'Couldn’t finish scanning';
  $('#loading-dots').textContent = '';
  showEta(message);
  $('#loading-retry').hidden = false;
}
