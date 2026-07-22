import { VOLUME_TO_ML, WEIGHT_TO_G, BAKE_PCT_CATEGORIES } from './constants.js';
import { asNumber, fmtPct, fmtPct1 } from './utils.js';
import { state } from './state.js';

// =====================================================================
// Normalisering og identitet for ingredienser
//
// Målet: "hvetemel siktet", "siktet hvetemel" og "Hvetemel, siktet" skal
// automatisk regnes som samme ingrediens. Ekte synonymer ("Ølandshvete
// siktet" = "siktet hvetemel") dekkes av state.ingredientAliases, som
// peker et normalisert variantnavn til et kanonisk navn.
// =====================================================================

export function normalizeIngredientName(navn) {
  if (!navn) return '';
  return navn
    .toLowerCase()
    .replace(/[.,;:()/\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

// Returnerer det kanoniske (normaliserte) navnet et ingrediensnavn peker til.
// Følger alias-kjeder ett steg: variant -> kanonisk.
export function resolveIngredientName(navn) {
  const norm = normalizeIngredientName(navn);
  const alias = state.ingredientAliases[norm];
  if (alias && alias.canonicalNavn) return normalizeIngredientName(alias.canonicalNavn);
  return norm;
}

// Finner rolle-/tetthet-oppføringen for et ingrediensnavn, via normalisering
// og alias. state.ingredientRoles er nøklet på lowercased navn.
export function findRoleData(navn) {
  if (!navn) return null;
  const target = resolveIngredientName(navn);
  if (!target) return null;
  for (const [name, data] of Object.entries(state.ingredientRoles)) {
    if (normalizeIngredientName(name) === target) return data;
  }
  return null;
}

export function lookupRole(navn) {
  const data = findRoleData(navn);
  return data ? data.rolle : '';
}

export function lookupTetthet(navn) {
  const data = findRoleData(navn);
  return data ? data.tetthet : null;
}

// Finner prisdata for et ingrediensnavn via samme identitetslogikk.
// state.bakeryPrices er nøklet på lowercased navn.
export function findPriceData(navn) {
  if (!navn) return null;
  const target = resolveIngredientName(navn);
  if (!target) return null;
  for (const [name, data] of Object.entries(state.bakeryPrices)) {
    if (normalizeIngredientName(name) === target) return data;
  }
  return null;
}

// =====================================================================
// Konvertering av ingredienser til gram
// =====================================================================

export function tilGram(ing) {
  const mengde = asNumber(ing.mengde);
  if (mengde === 0) return null;
  const enhet = (ing.enhet || '').trim().toLowerCase();
  if (WEIGHT_TO_G[enhet] !== undefined) return mengde * WEIGHT_TO_G[enhet];
  if (VOLUME_TO_ML[enhet] !== undefined) {
    const tetthet = lookupTetthet(ing.navn);
    if (tetthet === null || tetthet === undefined) return null;
    return mengde * VOLUME_TO_ML[enhet] * tetthet;
  }
  if (!enhet) return mengde;
  return null;
}

export function formatIngredientWithConv(ing) {
  const parts = [];
  if (ing.mengde !== null && ing.mengde !== undefined && ing.mengde !== '') parts.push(ing.mengde);
  if (ing.enhet) parts.push(ing.enhet);
  if (ing.navn) parts.push(ing.navn);
  const main = parts.join(' ');
  const enhet = (ing.enhet || '').trim().toLowerCase();
  if (VOLUME_TO_ML[enhet] !== undefined) {
    const gram = tilGram(ing);
    if (gram !== null && gram > 0) {
      return `${main} <span class="ing-conv">(≈ ${Math.round(gram)} g)</span>`;
    }
  }
  return main;
}

// =====================================================================
// Bakeprosent
// =====================================================================

export function calcBakePcts(ingList) {
  if (!Array.isArray(ingList)) return null;
  let melSiktet = 0, melSammalt = 0, vaeskeTotal = 0, salt = 0, deigvekt = 0;
  for (const ing of ingList) {
    const gram = tilGram(ing);
    if (gram === null || gram === 0) continue;
    deigvekt += gram;
    switch (ing.rolle) {
      case 'mel_siktet':   melSiktet += gram; break;
      case 'mel_sammalt':  melSammalt += gram; break;
      case 'væske':        vaeskeTotal += gram; break;
      case 'salt':         salt += gram; break;
      case 'forfermenter':
        melSiktet += gram / 2;
        vaeskeTotal += gram / 2;
        break;
    }
  }
  const melTotal = melSiktet + melSammalt;
  if (melTotal === 0) return { deigvekt };
  return {
    melTotal, melSiktet, melSammalt, vaeskeTotal, salt, deigvekt,
    hydrering: (vaeskeTotal / melTotal) * 100,
    saltPct: (salt / melTotal) * 100,
    grovhet: (melSammalt / melTotal) * 100,
  };
}

export function ingredientPct(ing, melTotal) {
  if (melTotal === 0) return null;
  const gram = tilGram(ing);
  if (gram === null || gram === 0) return null;
  return (gram / melTotal) * 100;
}

export function shouldShowBakePct(categoryId) {
  return BAKE_PCT_CATEGORIES.includes(categoryId);
}

export function bakePctSummaryHtml(pcts, showBakePct) {
  if (!pcts) return '';
  const deigvektStr = pcts.deigvekt > 0 ? `<span class="pct-label">Deigvekt </span><span class="pct-val">${Math.round(pcts.deigvekt)} g</span>` : '';
  if (!showBakePct || !pcts.hydrering) {
    return deigvektStr ? `<div class="bakepct-summary">${deigvektStr}</div>` : '';
  }
  return `<div class="bakepct-summary">
    <span class="pct-label">Hydrering </span><span class="pct-val">${fmtPct(pcts.hydrering)}</span>
    <span class="pct-label">Salt </span><span class="pct-val">${fmtPct1(pcts.saltPct)}</span>
    <span class="pct-label">Grovhet </span><span class="pct-val">${fmtPct(pcts.grovhet)}</span>
    ${deigvektStr}
  </div>`;
}

// =====================================================================
// Råvarekostnader
// =====================================================================

export function pricePerGram(prisData) {
  if (!prisData) return null;
  const pris = asNumber(prisData.pris);
  const pakkemengde = asNumber(prisData.pakkemengde);
  const enhet = (prisData.enhet || '').trim().toLowerCase();
  if (pakkemengde === 0) return null;
  if (WEIGHT_TO_G[enhet] !== undefined) {
    return { krPerGram: pris / (pakkemengde * WEIGHT_TO_G[enhet]), type: 'vekt' };
  }
  if (VOLUME_TO_ML[enhet] !== undefined) {
    return { krPerMl: pris / (pakkemengde * VOLUME_TO_ML[enhet]), type: 'volum' };
  }
  if (enhet === 'stk' || enhet === 'pakke') {
    return { krPerStk: pris / pakkemengde, type: 'stk' };
  }
  return null;
}

export function ingredientCost(ing, prisData) {
  if (!prisData) return null;
  const ppg = pricePerGram(prisData);
  if (!ppg) return null;
  const mengde = asNumber(ing.mengde);
  if (mengde === 0) return null;
  const enhet = (ing.enhet || '').trim().toLowerCase();
  if (ppg.type === 'stk') {
    if (enhet === 'stk' || enhet === 'pakke' || !enhet) return mengde * ppg.krPerStk;
    return null;
  }
  if (ppg.type === 'vekt') {
    const gram = tilGram(ing);
    if (gram === null) return null;
    return gram * ppg.krPerGram;
  }
  if (ppg.type === 'volum') {
    if (VOLUME_TO_ML[enhet] !== undefined) return (mengde * VOLUME_TO_ML[enhet]) * ppg.krPerMl;
    if (WEIGHT_TO_G[enhet] !== undefined) {
      const tetthet = lookupTetthet(ing.navn);
      if (!tetthet) return null;
      const gram = mengde * WEIGHT_TO_G[enhet];
      return (gram / tetthet) * ppg.krPerMl;
    }
    return null;
  }
  return null;
}

export function calcRecipeCost(ingList) {
  if (!Array.isArray(ingList)) return null;
  let totalCost = 0, knownCount = 0, unknownCount = 0;
  const unknownNames = [];
  for (const ing of ingList) {
    if (!ing.navn || asNumber(ing.mengde) === 0) continue;
    const prisData = findPriceData(ing.navn);
    if (prisData) {
      const cost = ingredientCost(ing, prisData);
      if (cost !== null) { totalCost += cost; knownCount++; }
      else { unknownCount++; unknownNames.push(ing.navn); }
    } else {
      unknownCount++; unknownNames.push(ing.navn);
    }
  }
  if (knownCount === 0) return null;
  return { totalCost, knownCount, unknownCount, unknownNames };
}

// =====================================================================
// Skalering for dagsplan
// =====================================================================

export function scaleIngredients(ingList, faktor) {
  if (!Array.isArray(ingList)) return [];
  return ingList.map(ing => {
    const mengde = asNumber(ing.mengde);
    return {
      ...ing,
      mengde: mengde === 0 ? ing.mengde : Math.round(mengde * faktor * 100) / 100
    };
  });
}

export function calcFaktor(element, baseDeigvekt) {
  if (!element) return 1;
  if (element.skaleringMode === 'faktor') {
    return asNumber(element.faktor) || 1;
  }
  if (element.skaleringMode === 'vekt') {
    const mal = asNumber(element.malDeigvekt);
    if (mal === 0 || baseDeigvekt === 0) return 1;
    return mal / baseDeigvekt;
  }
  if (element.skaleringMode === 'produkter') {
    const totalProduktVekt = (element.produkter || []).reduce((sum, p) => {
      return sum + (asNumber(p.antall) * asNumber(p.vektPerStk));
    }, 0);
    if (totalProduktVekt === 0 || baseDeigvekt === 0) return 1;
    return totalProduktVekt / baseDeigvekt;
  }
  return 1;
}

export function getRecipeDataForElement(element, isFrozen) {
  if (isFrozen && element.snapshot) {
    return {
      name: element.snapshot.name,
      category: element.snapshot.category,
      ingredientsList: element.snapshot.ingredientsList,
      deigvekt: element.snapshot.deigvekt
    };
  }
  const r = state.recipes.find(x => x.id === element.recipeId);
  if (!r) return null;
  const v = r.versions[0];
  const parts = (Array.isArray(v.parts) && v.parts.length > 0)
    ? v.parts
    : [{ ingredientsList: v.ingredientsList || [] }];
  const allIngredients = parts.flatMap(p => p.ingredientsList || []);
  const pcts = calcBakePcts(allIngredients);
  return {
    name: r.name,
    category: r.category,
    ingredientsList: allIngredients,
    deigvekt: pcts ? pcts.deigvekt : 0
  };
}

export function calcElementInfo(element, isFrozen) {
  if (element.type !== 'oppskrift') return null;
  const recipeData = getRecipeDataForElement(element, isFrozen);
  if (!recipeData) return null;

  const faktor = calcFaktor(element, recipeData.deigvekt);
  const scaledIng = scaleIngredients(recipeData.ingredientsList, faktor);
  const scaledCost = calcRecipeCost(scaledIng);
  const scaledDeigvekt = recipeData.deigvekt * faktor;

  let produkter = element.produkter || [];
  let totalProduktVekt = produkter.reduce((sum, p) => sum + (asNumber(p.antall) * asNumber(p.vektPerStk)), 0);

  return {
    name: recipeData.name,
    category: recipeData.category,
    baseDeigvekt: recipeData.deigvekt,
    faktor,
    scaledIng,
    scaledCost,
    scaledDeigvekt,
    produkter,
    totalProduktVekt,
    recipeMissing: !recipeData
  };
}

export function calcPlanCosts(plan, isFrozen) {
  let totalCost = 0;
  const productCosts = [];
  const missingPriceWarnings = [];

  for (const el of plan.elementer || []) {
    if (el.type !== 'oppskrift') continue;
    const info = calcElementInfo(el, isFrozen);
    if (!info) continue;
    if (info.scaledCost) {
      totalCost += info.scaledCost.totalCost;
      if (info.scaledCost.unknownCount > 0) {
        missingPriceWarnings.push(`${info.name}: ${info.scaledCost.unknownNames.join(', ')}`);
      }
    }

    if (info.produkter && info.produkter.length > 0 && info.totalProduktVekt > 0 && info.scaledCost) {
      const krPerGram = info.scaledCost.totalCost / info.totalProduktVekt;
      for (const p of info.produkter) {
        const antall = asNumber(p.antall);
        const vektPerStk = asNumber(p.vektPerStk);
        if (antall === 0 || vektPerStk === 0) continue;
        const kostPerStk = krPerGram * vektPerStk;
        productCosts.push({
          recipeName: info.name,
          productName: p.navn || info.name,
          antall, vektPerStk,
          kostPerStk,
          totalKost: kostPerStk * antall
        });
      }
    }
  }

  return { totalCost, productCosts, missingPriceWarnings };
}
