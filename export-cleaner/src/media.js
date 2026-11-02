// The media types on the start screen. Typing narrows the list by these
// keywords, all matched here on the computer. Not used for grouping yet.

export const MEDIA_TYPES = [
  { id: 'general', label: 'General', keywords: ['general', 'mixed', 'everything', 'all', 'misc', 'anything'] },
  { id: 'photographs', label: 'Photographs', keywords: ['photo', 'photography', 'camera', 'raw', 'lightroom', 'shoot', 'portrait', 'film', 'edit', 'grade'] },
  { id: 'mockups', label: 'Mockups', keywords: ['mockup', 'mock', 'presentation', 'scene', 'packaging', 'apparel', 'tee', 'shirt', 'merch'] },
  { id: 'graphic', label: 'Graphic & Type', keywords: ['graphic', 'type', 'typography', 'poster', 'logo', 'brand', 'branding', 'illustration', 'flyer', 'cover', 'print'] },
  { id: 'documents', label: 'Documents', keywords: ['document', 'pdf', 'deck', 'slides', 'report', 'resume', 'paper', 'text', 'pitch', 'presentation'] },
  { id: 'screenshots', label: 'Screenshots', keywords: ['screenshot', 'screen', 'capture', 'grab', 'reference', 'website'] },
  { id: 'product', label: 'Product Images', keywords: ['product', 'ecommerce', 'shop', 'store', 'catalog', 'flatlay', 'packshot', 'listing'] },
  { id: 'interface', label: 'User Interface', keywords: ['interface', 'ui', 'ux', 'app', 'web', 'website', 'figma', 'wireframe', 'dashboard'] },
];

// Types whose name or keywords begin with any word typed, best match first:
// the more typed words a type matches, the higher it ranks. Empty text lists every type.
export function matchTypes(text) {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (!words.length) return MEDIA_TYPES;
  const terms = (type) => [...type.label.toLowerCase().match(/[a-z]+/g), ...type.keywords];
  return MEDIA_TYPES
    .map((type) => ({ type, score: words.filter((word) => terms(type).some((term) => term.startsWith(word))).length }))
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
