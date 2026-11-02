// The media types on the start screen. Typing narrows the list by these
// keywords, all matched here on the computer. Not used for grouping yet.

export const MEDIA_TYPES = [
  { id: 'general', label: 'General', keywords: ['mixed', 'everything', 'all', 'misc', 'random', 'various', 'stuff', 'files', 'folder', 'anything'] },
  { id: 'photographs', label: 'Photographs', keywords: ['photo', 'photography', 'photographer', 'image', 'picture', 'pic', 'camera', 'raw', 'jpeg', 'jpg', 'lightroom', 'shoot', 'shot', 'portrait', 'landscape', 'street', 'film', 'analog', 'edit', 'grade', 'wedding', 'event', 'travel', 'dslr', 'iphone'] },
  { id: 'mockups', label: 'Mockups', keywords: ['mock', 'scene', 'presentation', 'render', 'packaging', 'apparel', 'tee', 'shirt', 'hoodie', 'merch', 'device', 'billboard', 'signage'] },
  { id: 'graphic', label: 'Graphic & Type', keywords: ['design', 'typography', 'font', 'lettering', 'poster', 'logo', 'brand', 'branding', 'identity', 'illustration', 'flyer', 'cover', 'album', 'print', 'social', 'instagram', 'post', 'artwork', 'vector', 'svg', 'icon'] },
  { id: 'documents', label: 'Documents', keywords: ['doc', 'pdf', 'deck', 'slide', 'presentation', 'report', 'resume', 'cv', 'paper', 'text', 'pitch', 'proposal', 'invoice', 'brochure', 'booklet', 'zine', 'magazine', 'layout', 'editorial'] },
  { id: 'screenshots', label: 'Screenshots', keywords: ['screen', 'capture', 'grab', 'reference', 'inspiration', 'moodboard', 'website', 'saved'] },
  { id: 'product', label: 'Product Images', keywords: ['image', 'picture', 'photo', 'shot', 'ecommerce', 'shop', 'store', 'shopify', 'catalog', 'flatlay', 'packshot', 'listing', 'item', 'still', 'amazon', 'etsy'] },
  { id: 'interface', label: 'User Interface', keywords: ['ui', 'ux', 'app', 'web', 'website', 'site', 'figma', 'wireframe', 'dashboard', 'screen', 'mobile', 'prototype', 'landing'] },
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

// Types that fit what was typed, best first; ties keep the list's order.
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
    .sort((a, b) => b.score - a.score)
    .map(({ type }) => type);
}

// The describe field: focusing it opens the whole list and typing narrows it.
// Nothing is pre-selected: the dark row is only where the pointer (or the
// arrow keys) are. Enter takes that row, otherwise the best match for what
// was typed, otherwise General, keeping the typed text for later.
// onChoose(type, text) reports the choice.
export function setUpMediaField(input, list, onChoose) {
  let shown = [];
  let active = -1;

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
  input.addEventListener('input', () => render(matchTypes(input.value)));
  input.addEventListener('blur', () => render([]));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      if (!shown.length) return;
      highlight(active < 0 ? (step > 0 ? 0 : shown.length - 1) : (active + step + shown.length) % shown.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(shown[active] ?? matchTypes(input.value)[0] ?? MEDIA_TYPES[0]);
    } else if (event.key === 'Escape') {
      input.blur();
    }
  });
}
