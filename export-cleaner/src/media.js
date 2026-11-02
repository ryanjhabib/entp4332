// The media types on the start screen. Typing narrows the list by these
// keywords; when none fit, a small text model compares the meaning of what
// was typed with each type's `about` phrases (see closestType). All of it runs
// here on the computer. Each type sets the grouping level the folder starts
// at (see LEVELS in main.js); the overview's Loose / Balanced / Strict toggle
// still overrides it.

export const MEDIA_TYPES = [
  { id: 'general', label: 'General', level: 'balanced', keywords: ['mixed', 'everything', 'all', 'misc', 'random', 'various', 'assorted', 'stuff', 'files', 'folder', 'anything', 'unsorted', 'junk', 'mess', 'messy', 'clutter', 'dump', 'leftovers', 'downloads', 'desktop', 'exports', 'archive', 'backup', 'untitled', 'unknown', 'idk', 'dunno', 'whatever'],
    about: ['a mixed folder of all kinds of files', 'unsorted downloads and random exports', 'a class project or school assignment', 'everything from my desktop'] },
  { id: 'photographs', label: 'Photographs', level: 'balanced', keywords: ['photo', 'photography', 'photographer', 'image', 'picture', 'pic', 'camera', 'raw', 'jpeg', 'jpg', 'lightroom', 'shoot', 'shot', 'portrait', 'landscape', 'street', 'film', 'analog', 'edit', 'grade', 'wedding', 'event', 'travel', 'dslr', 'iphone'],
    about: ['photographs from a camera shoot', 'portraits, landscapes, street and travel photos', 'photos from a wedding, concert or event', 'edited photos and film scans', 'photos of my pets, friends and family', 'a fashion lookbook or editorial shoot'] },
  { id: 'mockups', label: 'Mockups', level: 'loose', keywords: ['mock', 'scene', 'presentation', 'render', 'packaging', 'apparel', 'tee', 'shirt', 'hoodie', 'merch', 'device', 'billboard', 'signage'],
    about: ['mockups showing a design in a realistic scene', 'a design placed on a t-shirt, device, poster or packaging', 'merch and apparel mockups'] },
  { id: 'graphic', label: 'Graphic & Type', level: 'balanced', keywords: ['design', 'typography', 'font', 'lettering', 'poster', 'logo', 'brand', 'branding', 'identity', 'illustration', 'flyer', 'cover', 'album', 'print', 'social', 'instagram', 'post', 'artwork', 'vector', 'svg', 'icon'],
    about: ['graphic design: posters, logos and typography', 'a brand identity or brand refresh for a client', 'illustrations, album covers and social media posts', 'an advertising campaign', 'business cards, stationery and print design'] },
  { id: 'documents', label: 'Documents', level: 'balanced', keywords: ['doc', 'pdf', 'deck', 'slide', 'presentation', 'report', 'resume', 'cv', 'paper', 'text', 'pitch', 'proposal', 'invoice', 'brochure', 'booklet', 'zine', 'magazine', 'layout', 'editorial'],
    about: ['documents and PDFs', 'slide decks, pitch decks and presentations', 'a report, thesis, resume or portfolio', 'magazine and book layouts'] },
  { id: 'screenshots', label: 'Screenshots', level: 'strict', keywords: ['screen', 'capture', 'grab', 'reference', 'inspiration', 'moodboard', 'website', 'saved'],
    about: ['screenshots of websites and apps', 'images saved for reference or inspiration', 'a moodboard of saved images', 'screen grabs of posts and tweets'] },
  { id: 'product', label: 'Product Images', level: 'strict', keywords: ['image', 'picture', 'photo', 'shot', 'ecommerce', 'shop', 'store', 'shopify', 'catalog', 'flatlay', 'packshot', 'listing', 'item', 'still', 'amazon', 'etsy'],
    about: ['product photography for an online store', 'items shot on a plain background', 'flat lays and catalog listings', 'a merch or clothing drop'] },
  { id: 'interface', label: 'User Interface', level: 'strict', keywords: ['ui', 'ux', 'app', 'web', 'website', 'site', 'figma', 'wireframe', 'dashboard', 'screen', 'mobile', 'prototype', 'landing'],
    about: ['user interface design for an app or website', 'app screens, wireframes and dashboards', 'a website redesign', 'onboarding flows and prototypes'] },
];

// Words that say nothing about the type ("my product shots").
const FILLER = new Set(['my', 'the', 'a', 'an', 'of', 'and', 'for', 'some', 'old', 'new', 'from', 'with', 'i', 'im', 'its', 'mostly', 'just']);

// Whether a becomes b with at most one letter added, dropped or changed.
function oneEditApart(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1);
}

// How well one typed word fits one of a type's words: 1 when it's the word,
// or the word plus a plural ending ("images" → image); 0.75 when it begins
// the word ("photo" → photographs, "app" → apparel); 0.5 for a one-letter
// typo in a longer word ("photgraph"); otherwise 0.
function fit(word, term) {
  if (word === term || (term.length >= 2 && word.startsWith(term) && word.length - term.length <= 2)) return 1;
  if (term.startsWith(word)) return 0.75;
  if (word.length < 5) return 0;
  const n = word.length;
  return [n - 1, n, n + 1].some((length) => oneEditApart(word, term.slice(0, length))) ? 0.5 : 0;
}

// Types that fit what was typed, best first; ties keep the list's order,
// except that General, the catch-all, goes after a specific type.
// A word only counts as a typo when it matches nothing as typed, so
// "edits" finds edit, not editorial. Empty text lists every type.
export function matchTypes(text) {
  const words = (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => !FILLER.has(word));
  if (!words.length) return text.trim() ? [] : MEDIA_TYPES;
  const fits = MEDIA_TYPES.map((type) => {
    const terms = [...type.label.toLowerCase().match(/[a-z]+/g), ...type.keywords];
    return words.map((word) => Math.max(...terms.map((term) => fit(word, term))));
  });
  const typoOnly = words.map((_, w) => fits.every((type) => type[w] <= 0.5));
  return MEDIA_TYPES
    .map((type, t) => ({ type, score: fits[t].reduce((sum, f, w) => sum + (f > 0.5 || typoOnly[w] ? f : 0), 0) }))
    .filter(({ score }) => score)
    .sort((a, b) => b.score - a.score || (a.type.id === 'general') - (b.type.id === 'general'))
    .map(({ type }) => type);
}

// The meaning match: all-MiniLM-L6-v2 (Apache 2.0, about 23 MB quantised),
// through the same library as the image model. It downloads from Hugging Face
// the first time a description fits no keyword, then Chrome caches it. It runs
// on the processor, leaving the GPU to the scan; the typed text never leaves.
const TEXT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const ABOUT = MEDIA_TYPES.flatMap((type) => type.about.map(() => type));
let meaningReady = null;

function loadMeaning() {
  meaningReady ??= import('@huggingface/transformers').then(async ({ pipeline }) => {
    const embed = await pipeline('feature-extraction', TEXT_MODEL, { dtype: 'q8', device: 'wasm' });
    const vectors = await embed(MEDIA_TYPES.flatMap((type) => type.about), { pooling: 'mean', normalize: true });
    return { embed, phrases: vectors.tolist() };
  }).catch((error) => {
    meaningReady = null; // let a later description try again
    throw error;
  });
  return meaningReady;
}

// The type whose phrase is closest in meaning: "wedding album" → Photographs,
// "client brand refresh" → Graphic & Type.
export async function closestType(text) {
  const { embed, phrases } = await loadMeaning();
  const [query] = (await embed([text], { pooling: 'mean', normalize: true })).tolist();
  const scores = phrases.map((phrase) => phrase.reduce((sum, value, i) => sum + value * query[i], 0));
  return ABOUT[scores.indexOf(Math.max(...scores))];
}

// The describe field: focusing it opens the whole list and typing narrows it.
// Nothing is pre-selected: the dark row is only where the pointer (or the
// arrow keys) are. Enter takes that row, otherwise the best keyword match,
// otherwise the closest meaning (General if the model can't load).
// onChoose(type, text) reports the choice.
export function setUpMediaField(input, list, onChoose) {
  let shown = [];
  let active = -1;
  let thinking = false; // waiting on the meaning match, so a second Enter waits too

  const highlight = (i) => {
    active = i;
    list.querySelectorAll('li').forEach((row, k) => row.setAttribute('aria-selected', k === i));
    input.setAttribute('aria-activedescendant', i >= 0 ? `media-${shown[i].id}` : '');
  };

  const render = (types) => {
    shown = types;
    list.replaceChildren(...types.map((type, k) => {
      const row = document.createElement('li');
      row.id = `media-${type.id}`;
      row.role = 'option';
      row.textContent = type.label;
      row.addEventListener('pointerenter', () => highlight(k));
      row.addEventListener('pointerleave', () => highlight(-1));
      // pointerdown, not click, so the field keeps focus while choosing.
      row.addEventListener('pointerdown', (event) => { event.preventDefault(); choose(type); });
      return row;
    }));
    list.hidden = !types.length;
    input.setAttribute('aria-expanded', types.length > 0);
    highlight(-1);
  };

  const choose = (type) => {
    const text = input.value;
    input.value = type.label;
    input.blur();
    onChoose(type, text);
  };

  input.addEventListener('focus', () => {
    input.select(); // typing replaces an earlier choice
    render(MEDIA_TYPES);
  });
  input.addEventListener('input', () => {
    render(matchTypes(input.value));
    if (!shown.length) loadMeaning().catch(() => {}); // get it ready before Enter
  });
  input.addEventListener('blur', () => render([]));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      if (!shown.length) return;
      highlight(active < 0 ? (step > 0 ? 0 : shown.length - 1) : (active + step + shown.length) % shown.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const type = shown[active] ?? matchTypes(input.value)[0];
      if (type) choose(type);
      else if (!thinking) {
        thinking = true;
        closestType(input.value).catch(() => MEDIA_TYPES[0]).then((closest) => {
          thinking = false;
          choose(closest);
        });
      }
    } else if (event.key === 'Escape') {
      input.blur();
    }
  });
}
