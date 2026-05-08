import { VOLUME_TO_ML, WEIGHT_TO_G } from './constants.js';

// =====================================================================
// Datoer og formattering
// =====================================================================

export function fmt(iso) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('nb-NO', {
    day: '2-digit', month: 'short', year: 'numeric'
  }) + ' kl. ' + d.toLocaleTimeString('nb-NO', {
    hour: '2-digit', minute: '2-digit'
  });
}

export function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('nb-NO', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
}

export function todayISO() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

// =====================================================================
// Tall og parsing
// =====================================================================

export function asNumber(x) {
  if (x === null || x === undefined || x === '') return 0;
  if (typeof x === 'number') return x;
  const n = parseFloat(String(x).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export function hasNumberValue(x) {
  if (x === null || x === undefined) return false;
  if (typeof x === 'number') return !isNaN(x);
  return String(x).trim() !== '' && !isNaN(parseFloat(String(x).replace(',', '.')));
}

export function parseTetthet(str) {
  if (str === null || str === undefined || str === '') return null;
  const n = parseFloat(String(str).replace(',', '.'));
  return isNaN(n) ? null : n;
}

export function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return Math.round(n) + '%';
}

export function fmtPct1(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return n.toFixed(1) + '%';
}

export function fmtKr(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return n.toFixed(2).replace('.', ',') + ' kr';
}

// =====================================================================
// ID-generatorer
// =====================================================================

export function bakeryId(name) {
  return 'bakery_' + name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9æøå_]/g, '') + '_' + Date.now();
}

export function priceDocId(navn) {
  return navn.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9æøå_]/g, '');
}

export function ingredientRoleId(navn) {
  return navn.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9æøå_]/g, '');
}

export function planDocId() {
  return 'plan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// =====================================================================
// Ingrediens-formattering (uten state)
// =====================================================================

export function formatIngredient(ing) {
  const parts = [];
  if (ing.mengde !== null && ing.mengde !== undefined && ing.mengde !== '') parts.push(ing.mengde);
  if (ing.enhet) parts.push(ing.enhet);
  if (ing.navn) parts.push(ing.navn);
  return parts.join(' ');
}
