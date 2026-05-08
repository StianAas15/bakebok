export const DEFAULT_CATEGORIES = [
  { id: 'gjærbrød',  name: 'Brød på gjær',    icon: '' },
  { id: 'surdeig',   name: 'Brød på surdeig',  icon: '' },
  { id: 'søtbakst',  name: 'Søtbakst på gjær', icon: '' },
  { id: 'kjeks',     name: 'Kjeks og scones',   icon: '' },
  { id: 'kaker',     name: 'Kaker',             icon: '' },
  { id: 'andre',     name: 'Andre bakverk',     icon: '' },
];

export const BAKE_PCT_CATEGORIES = ['gjærbrød', 'surdeig', 'søtbakst'];

export const ROLE_OPTIONS = [
  { id: '',             label: '— ingen —' },
  { id: 'mel_siktet',   label: 'Mel siktet' },
  { id: 'mel_sammalt',  label: 'Mel sammalt' },
  { id: 'væske',        label: 'Væske' },
  { id: 'egg',          label: 'Egg' },
  { id: 'salt',         label: 'Salt' },
  { id: 'søtning',      label: 'Søtning' },
  { id: 'fett',         label: 'Fett' },
  { id: 'gjær',         label: 'Gjær' },
  { id: 'forfermenter', label: 'Forfermenter' },
  { id: 'frø',          label: 'Frø' },
  { id: 'nøtter',       label: 'Nøtter' },
  { id: 'krydder',      label: 'Krydder' },
  { id: 'annet',        label: 'Annet' },
];

export const VOLUME_TO_ML = {
  'l': 1000, 'liter': 1000, 'dl': 100, 'cl': 10, 'ml': 1,
  'ss': 15, 'spiseskje': 15, 'spiseskjeer': 15,
  'ts': 5, 'teskje': 5, 'teskjeer': 5,
  'knivsodd': 1, 'kopp': 240, 'cup': 240,
};

export const WEIGHT_TO_G = {
  'g': 1, 'gr': 1, 'gram': 1, 'kg': 1000, 'kilo': 1000,
};

export const PRICE_UNITS = ['kg', 'g', 'l', 'dl', 'ml', 'stk', 'pakke'];
