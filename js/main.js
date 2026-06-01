import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

import { auth, db } from './firebase.js';
import { DEFAULT_CATEGORIES, BAKE_PCT_CATEGORIES, ROLE_OPTIONS, VOLUME_TO_ML, WEIGHT_TO_G, PRICE_UNITS } from './constants.js';
import {
  fmt, fmtDateTime, fmtDateShort, todayISO,
  asNumber, hasNumberValue, parseTetthet,
  fmtPct, fmtPct1, fmtKr,
  bakeryId, priceDocId, ingredientRoleId, planDocId
} from './utils.js';
import { state, renderRef } from './state.js';

import {
  lookupRole, lookupTetthet, tilGram, formatIngredientWithConv,
  calcBakePcts, ingredientPct, shouldShowBakePct, bakePctSummaryHtml,
  pricePerGram, ingredientCost, calcRecipeCost,
  scaleIngredients, calcFaktor, getRecipeDataForElement, calcElementInfo, calcPlanCosts
} from './calculations.js';

import {
  loadRecipes, loadCustomCategories, loadBakeries,
  loadBakeryPrices, loadBakeryPlans, loadBakeryStandardTasks,
  loadAppSettings, loadIngredientRoles,
  saveRecipeToDb, deleteRecipeFromDb, uploadFile
} from './data.js';

import {
  isEmailAllowed, doGoogleLogin, doEmailLogin, doSignOut, createNewUser
} from './auth.js';

function allCategories() { return [...DEFAULT_CATEGORIES, ...state.customCategories]; }
function getCatName(id) { return allCategories().find(c=>c.id===id)?.name || id; }
function fmtPrintDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

// =====================================================================
// RENDER
// =====================================================================

function render() {
  const root = document.getElementById('root');
  if (state.view === 'login') { root.innerHTML = loginView(); bindLogin(); return; }
  root.innerHTML = `<div class="app">${
    state.view === 'settings' ? settingsView() :
    state.view === 'roles' ? rolesView() :
    state.view === 'bakeries_admin' ? bakeriesAdminView() :
    state.view === 'bakery_select' ? bakerySelectView() :
    state.view === 'bakery_home' ? bakeryHomeView() :
    state.view === 'bakery_recipes' ? bakeryRecipesView() :
    state.view === 'bakery_prices' ? bakeryPricesView() :
    state.view === 'bakery_plans' ? bakeryPlansView() :
    state.view === 'bakery_plan_edit' ? bakeryPlanEditView() :
    state.view === 'edit' ? editView() :
    state.view === 'recipe' ? recipeView() :
    state.view === 'recipes' ? recipesView() :
    homeView()
  }</div>`;
  if (state.view === 'edit') bindEdit();
  if (state.view === 'settings') bindSettings();
  if (state.view === 'roles') bindRoles();
  if (state.view === 'bakery_prices') bindPrices();
}

// =====================================================================
// VIEWS
// =====================================================================

function loginView() {
  return `
    <div class="login-wrap">
      <div style="text-align:center;margin-bottom:2rem">
        <div style="font-size:48px;margin-bottom:8px">🍞</div>
        <h1>Bakeboka</h1>
        <p class="muted" style="margin-top:4px">Din digitale oppskriftsbok</p>
      </div>
      <div class="card">
        <button class="btn-google" style="width:100%;justify-content:center;margin-bottom:8px" onclick="doGoogleLogin()">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
          Logg inn med Google
        </button>
        <div style="text-align:center;margin:12px 0;font-size:12px;color:#888">eller logg inn med e-post</div>
        <label>E-postadresse</label>
        <input type="email" id="l-email" placeholder="din@epost.no">
        <label>Passord</label>
        <input type="password" id="l-pass" placeholder="Passord">
        ${state.statusMsg?`<p class="status" style="color:#c0392b">${state.statusMsg}</p>`:''}
        <button class="btn-primary" style="width:100%;margin-top:12px" onclick="doEmailLogin()">Logg inn</button>
      </div>
    </div>`;
}

function bakeryBannerHtml() {
  if (state.bakeries.length === 0) return '';
  if (state.bakeries.length === 1) {
    const b = state.bakeries[0];
    return `<div class="bakery-banner" onclick="enterBakery('${b.id}')">
      <div class="bakery-banner-title">Mitt bakeri</div>
      <div class="bakery-banner-name">${b.name}</div>
      <div class="bakery-banner-action">Trykk for å åpne →</div>
    </div>`;
  }
  return `<div class="bakery-banner" onclick="setView('bakery_select')">
    <div class="bakery-banner-title">Mine bakerier</div>
    <div class="bakery-banner-name">Velg bakeri</div>
    <div class="bakery-banner-action">${state.bakeries.length} bakerier registrert →</div>
  </div>`;
}

function homeView() {
  const hero = state.coverImageUrl
    ? `<div class="hero" onclick="goHome()"><img src="${state.coverImageUrl}" alt="Forsidebilde"></div>`
    : `<div class="hero-placeholder" onclick="goHome()">🍞</div>`;

  const catGrid = allCategories().map(c => {
    const count = state.recipes.filter(r=>r.category===c.id).length;
    return `<button class="cat-btn ${state.activeCategory===c.id?'active':''}" onclick="selectCat('${c.id}')">
      <span class="cat-name">${c.name}</span>
      <span class="cat-count">${count} oppskrift${count!==1?'er':''}</span>
    </button>`;
  }).join('');

  const filtered = state.activeCategory ? state.recipes.filter(r=>r.category===state.activeCategory) : [];
  const catLabel = state.activeCategory ? getCatName(state.activeCategory) : '';

  const recipeList = state.activeCategory ? `
    <button class="btn" style="margin-bottom:12px" onclick="selectCat(null)">← Alle kategorier</button>
    <h2 style="margin-bottom:12px">${catLabel}</h2>
    ${filtered.length===0?`<div class="info-box">Ingen oppskrifter i denne kategorien ennå.</div>`:''}
    ${filtered.map(r=>{
      const thumb=r.versions.find(v=>v.images&&v.images.length>0)?.images[0]||null;
      return `<div class="card card-clickable" onclick="openRecipe('${r.id}')" style="display:flex;align-items:center;gap:12px">
        <div style="flex:1;min-width:0">
          <p style="font-weight:500">${r.name}</p>
          <p class="muted">Sist oppdatert ${fmt(r.versions[0].date)}</p>
        </div>
        ${thumb?`<img src="${thumb}" style="width:56px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0">`:''}
      </div>`;
    }).join('')}` : '';

  return `${hero}
    <div class="topbar no-print" style="padding-top:0"><h1>Bakeboka</h1>
    <div class="gap">
      <button class="btn" onclick="setView('settings')">Innstillinger</button>
        </div></div>
    ${state.loading?`<p class="status">Henter oppskrifter...</p>`:''}
    ${state.statusMsg && !state.loading?`<p class="status">${state.statusMsg}</p>`:''}
    ${!state.activeCategory ? bakeryBannerHtml() : ''}
<div class="card card-clickable" onclick="setView('recipes')" style="margin-bottom:12px">
        <p style="font-weight:500;margin-bottom:4px">Oppskriftsarkiv</p>
        <p class="muted" style="margin-bottom:0">${state.recipes.length} oppskrifter. Klikk for å bla i kategoriene.</p>
      </div>
      <div class="card card-clickable" onclick="setView('roles')" style="margin-bottom:12px">
        <p style="font-weight:500;margin-bottom:4px">Råvarer</p>
        <p class="muted" style="margin-bottom:0">${Object.keys(state.ingredientRoles).length} ingredienser. Klikk for å redigere roller og tettheter.</p>
      </div>`;
}

function recipesView() {
  const catGrid = allCategories().map(c => {
    const count = state.recipes.filter(r=>r.category===c.id).length;
    return `<button class="cat-btn ${state.activeCategory===c.id?'active':''}" onclick="selectCat('${c.id}')">
      <span class="cat-name">${c.name}</span>
      <span class="cat-count">${count} oppskrift${count!==1?'er':''}</span>
    </button>`;
  }).join('');

  const filtered = state.activeCategory ? state.recipes.filter(r=>r.category===state.activeCategory) : [];
  const catLabel = state.activeCategory ? getCatName(state.activeCategory) : '';

  const recipeList = state.activeCategory ? `
    <button class="btn" style="margin-bottom:12px" onclick="selectCat(null)">← Alle kategorier</button>
    <h2 style="margin-bottom:12px">${catLabel}</h2>
    ${filtered.length===0?`<div class="info-box">Ingen oppskrifter i denne kategorien ennå.</div>`:''}
    ${filtered.map(r=>{
      const thumb=r.versions.find(v=>v.images&&v.images.length>0)?.images[0]||null;
      return `<div class="card card-clickable" onclick="openRecipe('${r.id}')" style="display:flex;align-items:center;gap:12px">
        <div style="flex:1;min-width:0">
          <p style="font-weight:500">${r.name}</p>
          <p class="muted">Sist oppdatert ${fmt(r.versions[0].date)}</p>
        </div>
        ${thumb?`<img src="${thumb}" style="width:56px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0">`:''}
      </div>`;
    }).join('')}` : '';

  return `
    <div class="topbar no-print"><button class="btn" onclick="goHome()">← Hjem</button>
      <button class="btn-primary" onclick="startNew()">+ Ny oppskrift</button>
    </div>
    <h2 style="margin-bottom:12px">Oppskriftsarkiv</h2>
    ${!state.activeCategory ? `<div class="categories">${catGrid}</div>` : recipeList}`;
}
function bakerySelectView() {
  const list = state.bakeries.map(b => {
    const count = state.recipes.filter(r => Array.isArray(r.bakeries) && r.bakeries.includes(b.id)).length;
    return `<div class="card card-clickable" onclick="enterBakery('${b.id}')">
      <p style="font-weight:500">${b.name}</p>
      <p class="muted">${count} oppskrift${count!==1?'er':''}</p>
    </div>`;
  }).join('');
  return `
    <div class="topbar no-print"><button class="btn" onclick="goHome()">← Tilbake</button></div>
    <h2>Mine bakerier</h2>
    ${list || '<div class="info-box">Ingen bakerier registrert. Opprett ett under Innstillinger.</div>'}`;
}

function bakeryHomeView() {
  const b = state.bakeries.find(x => x.id === state.activeBakery);
  if (!b) { state.view = 'home'; state.activeBakery = null; return homeView(); }

  const modules = [
    { id: 'recipes', icon: '🍞', name: 'Oppskrifter', action: "enterBakeryRecipes()" },
    { id: 'prices', icon: '💰', name: 'Råvarepriser', action: "enterBakeryPrices()" },
    { id: 'plan', icon: '📋', name: 'Dagsplan', action: "enterBakeryPlans()" },
    { id: 'inventory', icon: '📦', name: 'Lager & bestilling', action: "moduleNotReady()" },
    { id: 'stats', icon: '📊', name: 'Statistikk', action: "moduleNotReady()" },
  ];

  const modBtns = modules.map(m => `
    <button class="module-btn" onclick="${m.action}">
      <span class="module-icon">${m.icon}</span>
      <span class="module-name">${m.name}</span>
    </button>`).join('');

  return `
    <div class="topbar no-print"><button class="btn" onclick="exitBakery()">← Hovedside</button></div>
    <p class="muted" style="margin-bottom:4px">Bakeri</p>
    <h1 style="margin-bottom:1.25rem">${b.name}</h1>
    ${state.statusMsg?`<p class="status">${state.statusMsg}</p>`:''}
    <div class="module-grid">${modBtns}</div>`;
}

function bakeryRecipesView() {
  const b = state.bakeries.find(x => x.id === state.activeBakery);
  if (!b) { state.view = 'home'; state.activeBakery = null; return homeView(); }

  const bakeryRecipes = state.recipes.filter(r => Array.isArray(r.bakeries) && r.bakeries.includes(b.id));

  const usedCategoryIds = [...new Set(bakeryRecipes.map(r => r.category))];
  const usedCategories = allCategories().filter(c => usedCategoryIds.includes(c.id));

  const chips = `
    <div class="filter-chips">
      <button class="chip ${!state.activeCategory?'active':''}" onclick="selectCat(null)">Alle <span class="chip-count">${bakeryRecipes.length}</span></button>
      ${usedCategories.map(c => {
        const count = bakeryRecipes.filter(r=>r.category===c.id).length;
        return `<button class="chip ${state.activeCategory===c.id?'active':''}" onclick="selectCat('${c.id}')">${c.name} <span class="chip-count">${count}</span></button>`;
      }).join('')}
    </div>`;

  const filtered = state.activeCategory ? bakeryRecipes.filter(r=>r.category===state.activeCategory) : bakeryRecipes;

  const recipeList = filtered.length === 0
    ? `<div class="info-box">Ingen oppskrifter ${state.activeCategory?'i denne kategorien':'er knyttet til bakeriet'} ennå.</div>`
    : filtered.map(r=>{
        const thumb=r.versions.find(v=>v.images&&v.images.length>0)?.images[0]||null;
        const catName = getCatName(r.category);
        return `<div class="card card-clickable" onclick="openRecipe('${r.id}')" style="display:flex;align-items:center;gap:12px">
          <div style="flex:1;min-width:0">
            <p style="font-weight:500">${r.name}</p>
            <p class="muted">${catName} · sist oppdatert ${fmt(r.versions[0].date)}</p>
          </div>
          ${thumb?`<img src="${thumb}" style="width:56px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0">`:''}
        </div>`;
      }).join('');

  return `
    <div class="topbar no-print"><button class="btn" onclick="exitBakeryRecipes()">← Bakeri</button>
    <div class="gap"><button class="btn-primary" onclick="startNew()">+ Ny oppskrift</button></div></div>
    <p class="muted" style="margin-bottom:4px">${b.name}</p>
    <h2 style="margin-bottom:8px">Oppskrifter</h2>
    ${bakeryRecipes.length > 0 ? chips : ''}
    ${recipeList}`;
}

function bakeryPricesView() {
  const b = state.bakeries.find(x => x.id === state.activeBakery);
  if (!b) { state.view = 'home'; state.activeBakery = null; return homeView(); }

  const search = (state.priceSearch || '').toLowerCase();
  const listSearch = (state.priceListSearch || '').toLowerCase();

  const allPriceEntries = Object.entries(state.bakeryPrices).sort((a, b) => a[0].localeCompare(b[0], 'nb'));
  const priceEntries = allPriceEntries.filter(([navn]) => !listSearch || navn.includes(listSearch));

  const priceList = priceEntries.length === 0
    ? `<p class="muted" style="margin-bottom:8px">Ingen råvarepriser registrert ennå. Bruk søkefeltet under for å legge til.</p>`
    : priceEntries.map(([navn, data]) => {
        const safeName = navn.replace(/'/g, "\\'");
        const ppg = pricePerGram(data);
        let perUnit = '';
        if (ppg) {
          if (ppg.type === 'vekt') perUnit = `${(ppg.krPerGram * 1000).toFixed(2).replace('.', ',')} kr/kg`;
          else if (ppg.type === 'volum') perUnit = `${(ppg.krPerMl * 1000).toFixed(2).replace('.', ',')} kr/l`;
          else if (ppg.type === 'stk') perUnit = `${ppg.krPerStk.toFixed(2).replace('.', ',')} kr/stk`;
        }
        if (state.editingPriceName === navn) {
          const unitOptsEdit = PRICE_UNITS.map(u =>
            `<option value="${u}" ${u === data.enhet ? 'selected' : ''}>${u}</option>`
          ).join('');
          const rowId = priceDocId(navn);
          return `
            <div class="price-row editing">
              <div>
                <div class="price-name">${navn}</div>
                <div class="price-info">Endre pris, pakkemengde eller enhet</div>
                ${data.oppdatert ? `<div class="price-info">Sist oppdatert ${fmtDateTime(data.oppdatert)}</div>` : ''}
                <div class="price-edit-grid">
                  <input type="text" id="edit-price-pris-${rowId}" value="${data.pris}" placeholder="kr">
                  <input type="text" id="edit-price-pakke-${rowId}" value="${data.pakkemengde}" placeholder="Pakkemengde">
                  <select id="edit-price-enhet-${rowId}">${unitOptsEdit}</select>
                </div>
                <div class="price-edit-buttons">
                  <button class="btn-primary" onclick="saveBakeryPriceEdit('${safeName}')">Lagre</button>
                  <button class="btn" onclick="cancelEditBakeryPrice()">Avbryt</button>
                </div>
              </div>
            </div>`;
        }
        return `
          <div class="price-row">
            <div>
              <div class="price-name">${navn}</div>
              <div class="price-info">${data.pris} kr / ${data.pakkemengde} ${data.enhet}</div>
              ${data.oppdatert ? `<div class="price-info">Sist oppdatert ${fmtDateTime(data.oppdatert)}</div>` : ''}
            </div>
            <div><div class="price-amount">${perUnit}</div></div>
            <div class="price-actions">
              <button class="btn" style="padding:4px 8px;font-size:12px" onclick="editBakeryPrice('${safeName}')">Endre</button>
              <button class="price-remove" onclick="deleteBakeryPrice('${safeName}')" title="Slett">×</button>
            </div>
          </div>`;
      }).join('');

  let suggestionsHtml = '';
  if (search.length >= 2) {
    const allIng = Object.keys(state.ingredientRoles)
      .filter(navn => navn.includes(search))
      .filter(navn => !state.bakeryPrices[navn])
      .sort((a, b) => a.localeCompare(b, 'nb'))
      .slice(0, 8);
    if (allIng.length > 0) {
      suggestionsHtml = `
        <p class="muted" style="margin:10px 0 6px">Forslag fra ingredienslista:</p>
        ${allIng.map(navn => `
          <div class="price-suggestion" onclick="selectPriceIngredient('${navn}')">${navn}</div>
        `).join('')}`;
    } else {
      suggestionsHtml = `<p class="muted" style="margin-top:10px">Ingen treff. Du kan også legge til prisen direkte under.</p>`;
    }
  }

  const unitOpts = PRICE_UNITS.map(u => `<option value="${u}">${u}</option>`).join('');

  return `
    <div class="topbar no-print"><button class="btn" onclick="exitBakeryPrices()">← Bakeri</button></div>
    <p class="muted" style="margin-bottom:4px">${b.name}</p>
    <h2 style="margin-bottom:12px">Råvarepriser</h2>

    <div class="card">
      <p style="font-weight:500;margin-bottom:8px">Legg til pris</p>
      <p class="muted" style="margin-bottom:10px">Søk i ingredienslista, så fyller jeg ut navnet for deg.</p>
      <input type="text" id="price-search" placeholder="Søk etter ingrediens..." value="${state.priceSearch || ''}">
      ${suggestionsHtml}
      <label>Ingrediens</label>
      <input type="text" id="new-price-navn" placeholder="F.eks. hvetemel" value="${window._newPriceNavn || ''}">
      <label>Pris og pakkemengde</label>
      <div class="add-price-grid">
        <input type="text" id="new-price-pris" placeholder="kr">
        <input type="text" id="new-price-pakke" placeholder="Pakkemengde (f.eks. 25)">
        <select id="new-price-enhet">${unitOpts}</select>
      </div>
      <button class="btn-primary" style="width:100%;margin-top:6px" onclick="addBakeryPrice()">+ Lagre pris</button>
    </div>

    <div class="card">
      <p style="font-weight:500;margin-bottom:10px">Mine priser (${priceEntries.length} av ${allPriceEntries.length})</p>
      <input type="text" id="price-list-search" placeholder="Søk i mine priser..." value="${state.priceListSearch || ''}" style="margin-bottom:10px">
      ${priceList}
    </div>
    ${state.statusMsg?`<p class="status">${state.statusMsg}</p>`:''}`;
}

function bakeryPlansView() {
  const b = state.bakeries.find(x => x.id === state.activeBakery);
  if (!b) { state.view = 'home'; state.activeBakery = null; return homeView(); }

  const sortedPlans = [...state.bakeryPlans].sort((a, b) => {
    const da = new Date(a.dato).getTime();
    const db_ = new Date(b.dato).getTime();
    return db_ - da;
  });

  const plansList = sortedPlans.length === 0
    ? `<div class="info-box">Ingen dagsplaner ennå. Trykk «+ Ny dagsplan» for å lage den første.</div>`
    : sortedPlans.map(p => {
        const elementCount = (p.elementer || []).length;
        const oppskrifterCount = (p.elementer || []).filter(e => e.type === 'oppskrift').length;
        const oppgaverCount = elementCount - oppskrifterCount;
        const statusClass = p.status === 'gjennomført' ? 'plan-status-gjennomført' : 'plan-status-planlagt';
        const statusLabel = p.status === 'gjennomført' ? 'Gjennomført' : 'Planlagt';
        return `
          <div class="plan-list-item" onclick="openPlan('${p.id}')">
            <div class="plan-list-info">
              <div class="plan-list-name">${fmtDateShort(p.dato)}</div>
              <div class="plan-list-meta">${oppskrifterCount} oppskrift${oppskrifterCount===1?'':'er'}, ${oppgaverCount} oppgave${oppgaverCount===1?'':'r'}</div>
            </div>
            <span class="plan-status-badge ${statusClass}">${statusLabel}</span>
          </div>`;
      }).join('');

  return `
    <div class="topbar no-print"><button class="btn" onclick="exitBakeryPlans()">← Bakeri</button>
    <div class="gap"><button class="btn-primary" onclick="startNewPlan()">+ Ny dagsplan</button></div></div>
    <p class="muted" style="margin-bottom:4px">${b.name}</p>
    <h2 style="margin-bottom:12px">Dagsplaner</h2>
    ${state.statusMsg?`<p class="status">${state.statusMsg}</p>`:''}
    <div class="card">${plansList}</div>`;
}

function bakeryPlanEditView() {
  const b = state.bakeries.find(x => x.id === state.activeBakery);
  if (!b) { state.view = 'home'; state.activeBakery = null; return homeView(); }
  if (!state.activePlan) { state.view = 'bakery_plans'; return bakeryPlansView(); }

  const isFrozen = state.activePlan.status === 'gjennomført';
  const elementer = state.activePlan.elementer || [];

  const elementsHtml = elementer.map((el, idx) => renderPlanElement(el, idx, isFrozen)).join('');

  const costData = calcPlanCosts(state.activePlan, isFrozen);
  const costSummaryHtml = `
    <div class="day-cost-summary no-print">
      <div class="day-cost-total">Total råvarekostnad: ${fmtKr(costData.totalCost)}</div>
      ${costData.productCosts.length > 0 ? `
        <div style="font-weight:500;margin-bottom:4px;font-size:13px">Per produkt:</div>
        ${costData.productCosts.map(pc => `
          <div class="day-cost-product-row">
            <span>${pc.productName} (${pc.antall} stk × ${pc.vektPerStk} g)</span>
            <span><strong>${fmtKr(pc.kostPerStk)}/stk</strong> · ${fmtKr(pc.totalKost)} totalt</span>
          </div>
        `).join('')}
      ` : '<div class="muted">Ingen produkter er definert.</div>'}
      ${costData.missingPriceWarnings.length > 0 ? `
        <div class="muted" style="margin-top:8px;color:#856404">⚠ Manglende priser: ${costData.missingPriceWarnings.join(' · ')}</div>
      ` : ''}
    </div>`;

  const bakeryRecipes = state.recipes.filter(r => Array.isArray(r.bakeries) && r.bakeries.includes(state.activeBakery));
  const recipeOpts = bakeryRecipes
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
    .map(r => `<option value="${r.id}">${r.name}</option>`).join('');

  const usedTaskNames = elementer.filter(e => e.type === 'oppgave').map(e => e.navn);
  const availableStandardTasks = state.bakeryStandardTasks.filter(t => !usedTaskNames.includes(t.navn));

  const taskCheckboxes = availableStandardTasks.length === 0
    ? `<p class="muted" style="margin-bottom:6px">Ingen standardoppgaver registrert ennå. Skriv inn ny oppgave under for å legge til.</p>`
    : availableStandardTasks.map(t => `
        <div class="standard-task-row">
          <input type="checkbox" id="task-${t.id}" data-task="${t.navn.replace(/"/g, '&quot;')}">
          <label for="task-${t.id}">${t.navn}</label>
          <button class="delete-btn" onclick="deleteStandardTask('${t.id}')" title="Slett standardoppgave">×</button>
        </div>
      `).join('');

  return `
    <div class="topbar no-print"><button class="btn" onclick="commitAnd(exitPlanEdit)">← Dagsplaner</button>
    <div class="gap">
      <button class="btn no-print" onclick="commitAnd(printPlan)">🖨 Skriv ut</button>
      ${!isFrozen ? `<button class="btn" onclick="commitAnd(markPlanGjennomført)">Marker gjennomført</button>` : `<button class="btn" onclick="commitAnd(markPlanPlanlagt)">Endre til planlagt</button>`}
      <button class="btn" onclick="commitAnd(copyPlan)">📋 Kopier plan</button>
      <button class="btn-danger" onclick="commitAnd(deletePlan)">Slett</button>
    </div></div>

    <p class="muted no-print" style="margin-bottom:4px">${b.name}</p>
    <h2 style="margin-bottom:4px">
      <span>Dagsplan</span>
      <span class="print-only print-plan-date">${fmtPrintDate(state.activePlan.dato)}</span>
    </h2>

    <div class="card no-print">
      <label>Dato</label>
      <input type="date" id="plan-dato" value="${state.activePlan.dato}" ${isFrozen ? 'disabled' : ''}>
      <p class="muted" style="margin-top:8px">Status: <strong>${isFrozen ? 'Gjennomført (frosset)' : 'Planlagt (live)'}</strong>${isFrozen ? ' <span class="plan-status-frosset">snapshot lagret</span>' : ''}</p>
    </div>

    ${elementer.length === 0
      ? `<div class="info-box">Ingen elementer i planen ennå. Bruk knappene under for å legge til.</div>`
      : `<div>${elementsHtml}</div>`}

    ${!isFrozen ? `
      <div class="card no-print">
        <p style="font-weight:500;margin-bottom:8px">Legg til oppskrift</p>
        ${bakeryRecipes.length === 0
          ? `<p class="muted">Ingen oppskrifter er knyttet til dette bakeriet. Gå tilbake og tag oppskrifter med bakeriet først.</p>`
          : `
            <select id="add-recipe-select">${recipeOpts}</select>
            <button class="btn-primary" style="width:100%;margin-top:8px" onclick="addRecipeToPlan()">+ Legg til valgt oppskrift</button>
          `}
      </div>

      <div class="card no-print">
        <p style="font-weight:500;margin-bottom:8px">Legg til oppgaver</p>
        <p class="muted" style="margin-bottom:8px">Standardoppgaver gjenbrukes mellom dagsplaner.</p>
        ${taskCheckboxes}
        ${availableStandardTasks.length > 0 ? `
          <button class="btn-primary" style="width:100%;margin-top:8px" onclick="addCheckedTasksToPlan()">+ Legg til avkryssede oppgaver</button>
        ` : ''}
        <label>Ny standardoppgave</label>
        <div style="display:flex;gap:8px">
          <input type="text" id="new-task-name" placeholder="F.eks. Vask heveskap">
          <button class="btn" style="white-space:nowrap" onclick="addNewStandardTask()">Lagre + bruk</button>
        </div>
      </div>
    ` : ''}

    ${costSummaryHtml}

    ${state.statusMsg?`<p class="status no-print">${state.statusMsg}</p>`:''}`;
}

function commitPlanEdit() {
  savePlan();
  render();
}

function commitAnd(action) {
  flushPlanInputs();
  savePlan();
  render();
  if (typeof action === 'function') {
    setTimeout(action, 0);
  }
}

function flushPlanInputs() {
  if (!state.activePlan || state.editingElementIdx === null) return;
  const idx = state.editingElementIdx;
  const el = state.activePlan.elementer[idx];
  if (!el) return;

  if (el.skaleringMode === 'faktor') {
    const inp = document.getElementById(`scale-faktor-${idx}`);
    if (inp) el.faktor = inp.value;
  }
  if (el.skaleringMode === 'produkter') {
    const navnInputs = document.querySelectorAll(`#product-rows-${idx} .prod-navn`);
    const antallInputs = document.querySelectorAll(`#product-rows-${idx} .prod-antall`);
    const vektInputs = document.querySelectorAll(`#product-rows-${idx} .prod-vekt`);
    if (!el.produkter) el.produkter = [];
    navnInputs.forEach((inp, i) => {
      if (!el.produkter[i]) el.produkter[i] = { navn: '', antall: '', vektPerStk: '' };
      el.produkter[i].navn = inp.value;
      el.produkter[i].antall = antallInputs[i] ? antallInputs[i].value : '';
      el.produkter[i].vektPerStk = vektInputs[i] ? vektInputs[i].value : '';
    });
  }
}

function printPlan() {
  window.print();
}

function renderPlanElement(el, idx, isFrozen) {
  const isEditing = state.editingElementIdx === idx && !isFrozen;
  const doneClass = el.gjort ? 'done' : '';
  const moveBtns = isFrozen ? '' : `<button class="plan-element-move no-print" onclick="moveElement(${idx}, -1)" title="Flytt opp">▲</button><button class="plan-element-move no-print" onclick="moveElement(${idx}, 1)" title="Flytt ned">▼</button>`;

  if (el.type === 'oppgave') {
    return `
      <div class="plan-element plan-task ${doneClass}">
        <div class="plan-element-head">
          <input type="checkbox" class="plan-element-checkbox" ${el.gjort?'checked':''} ${isFrozen?'disabled':''} onchange="toggleElementDone(${idx})">
          <div class="plan-element-name ${doneClass}">${el.navn}</div>
          ${moveBtns}${!isFrozen ? `<button class="plan-element-remove no-print" onclick="removeElement(${idx})">×</button>` : ''}
        </div>
      </div>`;
  }

  const info = calcElementInfo(el, isFrozen);
  if (!info) {
    return `
      <div class="plan-element ${doneClass}">
        <div class="plan-element-head">
          <input type="checkbox" class="plan-element-checkbox" ${el.gjort?'checked':''} ${isFrozen?'disabled':''} onchange="toggleElementDone(${idx})">
          <div class="plan-element-name">⚠ Oppskrift ikke funnet (slettet?)</div>
        ${moveBtns}${!isFrozen ? `<button class="plan-element-remove no-print" onclick="removeElement(${idx})">×</button>` : ''}
        </div>
      </div>`;
  }

 // Skalering-info-tekst
  let modeLabel = '';
  if (el.skaleringMode === 'faktor') {
    const f = asNumber(el.faktor);
    if (f !== 1) modeLabel = `${f.toString().replace('.', ',')}×`;
  }
  else if (el.skaleringMode === 'vekt') modeLabel = `${Math.round(info.scaledDeigvekt)} g deig`;
  else if (el.skaleringMode === 'produkter') {
    const validProds = (el.produkter || []).filter(p =>
      asNumber(p.antall) > 0 && asNumber(p.vektPerStk) > 0
    );
    const prods = validProds.map(p =>
      `${p.antall}× ${p.navn || 'produkt'} à ${p.vektPerStk} g`
    ).join(', ');
    modeLabel = prods || `${Math.round(info.scaledDeigvekt)} g deig`;
  }

  const ingLine = info.scaledIng
    .filter(ing => ing.navn && asNumber(ing.mengde) > 0)
    .map(ing => {
      let s = '';
      const m = asNumber(ing.mengde);
      if (m > 0) {
        s += m % 1 === 0 ? Math.round(m) : m.toFixed(1).replace('.', ',');
        s += ' ';
      }
      if (ing.enhet) s += ing.enhet + ' ';
      s += ing.navn;
      return s;
    }).join(', ');

  const deigvektStr = info.scaledDeigvekt > 0 ? `${Math.round(info.scaledDeigvekt)} g deig` : '';

  let editorHtml = '';
  if (isEditing) {
    editorHtml = renderPlanElementEditor(el, idx, info.baseDeigvekt);
  }

  return `
    <div class="plan-element ${doneClass}">
      <div class="plan-element-head">
        <input type="checkbox" class="plan-element-checkbox" ${el.gjort?'checked':''} ${isFrozen?'disabled':''} onchange="toggleElementDone(${idx})">
        <div class="plan-element-name ${doneClass}">${info.name}</div>
        ${moveBtns}${!isFrozen ? `<button class="plan-element-remove no-print" onclick="removeElement(${idx})">×</button>` : ''}
      </div>
      <div class="plan-element-meta">${modeLabel}${deigvektStr && el.skaleringMode !== 'vekt' ? ' · ' + deigvektStr : ''}</div>
      <div class="plan-element-ingredients">${ingLine}</div>
      ${!isFrozen ? `
        <div class="plan-element-edit no-print">
          <button class="plan-element-edit-btn" onclick="${isEditing ? 'cancelEditElement()' : 'editElement('+idx+')'}">${isEditing ? 'Lukk skalering' : 'Endre skalering'}</button>
        </div>
      ` : ''}
      ${editorHtml}
    </div>`;
}

function renderPlanElementEditor(el, idx, baseDeigvekt) {
  const mode = el.skaleringMode || 'faktor';
  const produkter = el.produkter || [{ navn: '', antall: '', vektPerStk: '' }];

 const produktRows = produkter.map((p, pi) => `
    <div class="product-row">
      <input type="text" class="prod-navn" data-idx="${pi}" placeholder="Navn (f.eks. Loff)" value="${p.navn || ''}" oninput="updateProductField(${idx}, ${pi}, 'navn', this.value)">
      <input type="text" class="prod-antall" data-idx="${pi}" placeholder="Antall" value="${p.antall || ''}" oninput="updateProductField(${idx}, ${pi}, 'antall', this.value)">
      <input type="text" class="prod-vekt" data-idx="${pi}" placeholder="g/stk" value="${p.vektPerStk || ''}" oninput="updateProductField(${idx}, ${pi}, 'vektPerStk', this.value)">
      <button onclick="removeProductRow(${idx}, ${pi})" title="Fjern">×</button>
    </div>
  `).join('');

  return `
    <div class="plan-recipe-edit no-print">
      <label>Skaleringsmodus</label>
      <div class="scale-mode-row">
        <button class="scale-mode-btn ${mode==='faktor'?'active':''}" onclick="setScaleMode(${idx}, 'faktor')">Mengde deig</button>
        <button class="scale-mode-btn ${mode==='produkter'?'active':''}" onclick="setScaleMode(${idx}, 'produkter')">Produkter</button>
      </div>

      ${mode === 'faktor' ? `
        <label>Multipliser grunnoppskriftens deigvekt (${baseDeigvekt > 0 ? Math.round(baseDeigvekt) : '?'} g) med</label>
      <input type="text" id="scale-faktor-${idx}" value="${el.faktor || ''}" placeholder="F.eks. 1,5" oninput="updateScaleField(${idx}, 'faktor', this.value)" onblur="commitPlanEdit()">
      ` : ''}

      ${mode === 'produkter' ? `
        <label>Produkter fra denne deigen</label>
        <div class="product-row-header">
          <span>Navn</span><span>Antall</span><span>g/stk</span><span></span>
        </div>
        <div id="product-rows-${idx}">${produktRows}</div>
        <button class="btn" style="margin-top:6px;font-size:12px;padding:4px 10px" onclick="addProductRow(${idx})">+ Legg til produkt</button>
      ` : ''}
    </div>`;
}

function settingsView() {
  const customList = state.customCategories.length===0
    ? `<p class="muted" style="margin-bottom:12px">Ingen egne kategorier ennå.</p>`
    : state.customCategories.map(c=>`
        <div class="cat-row">
          <span style="font-size:14px">${c.name}</span>
          <button class="btn-danger" style="padding:4px 10px;font-size:12px" onclick="deleteCustomCat('${c.id}')">Slett</button>
        </div>`).join('');
  return `
    <div class="topbar no-print"><button class="btn" onclick="setView('home')">← Tilbake</button></div>
    <h2>Innstillinger</h2>
    <div class="card">
      <p style="font-size:13px;margin-bottom:4px">Innlogget som: <strong>${state.currentUser?.email||''}</strong></p>
      <button class="btn" style="margin-top:8px" onclick="doSignOut()">Logg ut</button>
    </div>
    <div class="card">
      <p style="font-weight:500;margin-bottom:8px">Forsidebilde</p>
      ${state.coverImageUrl?`<img src="${state.coverImageUrl}" style="width:100%;border-radius:8px;margin-bottom:12px;max-height:150px;object-fit:cover">`:`<p class="muted" style="margin-bottom:12px">Ingen bilde valgt ennå.</p>`}
      <input type="file" id="cover-input" accept="image/*" style="display:none">
      <button class="btn" onclick="document.getElementById('cover-input').click()">Last opp forsidebilde</button>
    </div>
    <div class="card">
      <p style="font-weight:500;margin-bottom:12px">Egne kategorier</p>
      ${customList}
      <div style="display:flex;gap:8px;margin-top:12px">
        <input type="text" id="new-cat-name" placeholder="F.eks. Marmelade">
        <button class="btn-primary" style="white-space:nowrap" onclick="addCustomCat()">+ Legg til</button>
      </div>
    </div>
    <div class="card card-clickable" onclick="setView('bakeries_admin')">
      <p style="font-weight:500;margin-bottom:4px">Mine bakerier</p>
      <p class="muted">${state.bakeries.length} bakeri${state.bakeries.length===1?'':'er'} registrert. Klikk for å opprette eller endre.</p>
    </div>
       <div class="card">
      <p style="font-weight:500;margin-bottom:8px">Opprett ny bruker</p>
      <p class="muted" style="margin-bottom:10px">Legg til en ny person som skal ha tilgang til appen.</p>
      <label>E-postadresse</label>
      <input type="email" id="new-user-email" class="${state.validationErrors.userEmail?'input-error':''}" placeholder="navn@epost.no">
      <label>Midlertidig passord</label>
      <input type="text" id="new-user-pass" class="${state.validationErrors.userPass?'input-error':''}" placeholder="Minst 6 tegn">
      <button class="btn-primary" style="margin-top:10px;width:100%" onclick="createNewUser()">Opprett bruker</button>
    </div>
    <div class="card">
      <p style="font-weight:500;margin-bottom:6px">Claude API-nøkkel</p>
      <p class="muted" style="margin-bottom:8px">Brukes til å lese oppskrifter fra bilder.</p>
      ${state.anthropicKey?`<p style="font-size:13px;color:#1D9E75;margin-bottom:8px">✅ API-nøkkel er lagret</p>`:`<p style="font-size:13px;color:#c0392b;margin-bottom:8px">❌ Ingen API-nøkkel</p>`}
      <input type="password" id="akey-input" placeholder="sk-ant-...">
      <button class="btn-primary" style="margin-top:10px;width:100%" onclick="saveApiKey()">Lagre nøkkel</button>
    </div>
    ${state.statusMsg?`<p class="status">${state.statusMsg}</p>`:''}`;
}

function bakeriesAdminView() {
  const list = state.bakeries.length === 0
    ? `<p class="muted" style="margin-bottom:12px">Ingen bakerier ennå.</p>`
    : state.bakeries.map(b => {
        const count = state.recipes.filter(r => Array.isArray(r.bakeries) && r.bakeries.includes(b.id)).length;
        return `
        <div class="cat-row">
          <span style="font-size:14px"><strong>${b.name}</strong> <span class="muted">(${count} oppskrift${count!==1?'er':''})</span></span>
          <button class="btn-danger" style="padding:4px 10px;font-size:12px" onclick="deleteBakery('${b.id}')">Slett</button>
        </div>`;
      }).join('');
  return `
    <div class="topbar no-print"><button class="btn" onclick="setView('settings')">← Tilbake</button></div>
    <h2>Mine bakerier</h2>
    <div class="card">
      <p class="muted" style="margin-bottom:10px">Bakerier brukes til å organisere oppskrifter og verktøy som hører til en spesifikk produksjon. Du kan tagge en oppskrift med flere bakerier.</p>
      ${list}
      <div style="display:flex;gap:8px;margin-top:12px">
        <input type="text" id="new-bakery-name" placeholder="F.eks. Bryggerhuset Bakst">
        <button class="btn-primary" style="white-space:nowrap" onclick="addBakery()">+ Opprett</button>
      </div>
    </div>
    ${state.statusMsg?`<p class="status">${state.statusMsg}</p>`:''}`;
}

function rolesView() {
  const search = (state.roleSearch || '').toLowerCase();
  const entries = Object.entries(state.ingredientRoles)
    .sort((a, b) => a[0].localeCompare(b[0], 'nb'))
    .filter(([navn]) => !search || navn.includes(search));
  const roleOptionsHtml = (selected) =>
    ROLE_OPTIONS.map(r => `<option value="${r.id}" ${r.id===selected?'selected':''}>${r.label}</option>`).join('');
  const rows = entries.map(([navn, data]) => {
    const tetthetVal = (data.tetthet === null || data.tetthet === undefined) ? '' : data.tetthet;
    return `
    <div class="role-row" data-navn="${navn}">
      <input type="text" class="role-navn" value="${navn}" data-original="${navn}">
      <select class="role-rolle">${roleOptionsHtml(data.rolle)}</select>
      <input type="text" class="role-tetthet" value="${tetthetVal}" placeholder="g/ml">
      <button type="button" class="role-remove" onclick="deleteIngredientRole('${navn}')" title="Slett">×</button>
    </div>`;
  }).join('');
  return `
    <div class="topbar no-print"><button class="btn" onclick="setView('home')">← Tilbake</button></div>
    <h2>Råvarer</h2>
    <div class="card">
      <p class="muted" style="margin-bottom:10px">Ingredienser i lista brukes til å foreslå rolle og tetthet automatisk når du legger inn nye ingredienser. Tetthet (g/ml) brukes til å regne om volumenheter (dl, ss, ts) til gram. Endringer lagres når du klikker «Lagre endringer».</p>
      <div class="role-search">
        <input type="text" id="role-search" placeholder="Søk i lista..." value="${state.roleSearch || ''}">
      </div>
      <p class="muted">Viser ${entries.length} av ${Object.keys(state.ingredientRoles).length} ingredienser.</p>
    </div>
    <div class="card">
      <p style="font-weight:500;margin-bottom:8px">Legg til ny ingrediens</p>
      <div class="role-row">
        <input type="text" id="new-role-navn" placeholder="F.eks. Bjørkeblad">
        <select id="new-role-rolle">${roleOptionsHtml('annet')}</select>
        <input type="text" id="new-role-tetthet" placeholder="g/ml">
        <button type="button" class="btn-primary" style="padding:6px 10px;font-size:13px" onclick="addIngredientRole()">+</button>
      </div>
    </div>
    <div class="card">
      <div class="role-list-header">
        <span>Navn</span><span>Rolle</span><span>Tetthet</span><span></span>
      </div>
      <div class="role-list">${rows || '<p class="muted">Ingen treff.</p>'}</div>
      <button class="btn-primary" style="width:100%;margin-top:12px" onclick="saveAllRoleEdits()">Lagre endringer</button>
    </div>
    ${state.statusMsg?`<p class="status">${state.statusMsg}</p>`:''}`;
}

function recipeView() {
  const r = state.recipes.find(x=>x.id===state.selected);
  if (!r) { state.view='home'; return homeView(); }
  const v = r.versions[state.selectedVersion];
  const catName = getCatName(r.category);
  const tabs = r.versions.length>1?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${r.versions.map((ver,i)=>
    `<button class="btn" style="font-size:12px;${i===state.selectedVersion?'background:#f0f0e8':''}" onclick="selVer(${i})">v${r.versions.length-i} · ${fmt(ver.date)}</button>`).join('')}</div>`:'';
  const imgs=(v.images||[]).map(img=>`<img class="recipe-img" src="${img}" alt="">`).join('');
  const ingList = (v.ingredientsList || []);
  const showPct = shouldShowBakePct(r.category);
  const pcts = calcBakePcts(ingList);
  const melTotal = pcts && pcts.melTotal ? pcts.melTotal : 0;
  const ingHtml = ingList.length === 0
    ? `<p class="muted">Ingen ingredienser registrert.</p>`
    : ingList.map(ing => {
        const main = formatIngredientWithConv(ing);
        const merknad = ing.merknad ? `<span class="ing-merknad-text">(${ing.merknad})</span>` : '';
        let pctStr = '';
        if (showPct && melTotal > 0) {
          const p = ingredientPct(ing, melTotal);
          if (p !== null) pctStr = `<span class="ing-pct-text">${Math.round(p)}%</span>`;
        }
        return `<div class="ing-list-item"><span>${main}${merknad}</span>${pctStr}</div>`;
      }).join('');

  let costHtml = '';
  if (state.activeBakery) {
    const cost = calcRecipeCost(ingList);
    if (cost) {
      const perKg = pcts && pcts.deigvekt > 0 ? (cost.totalCost / pcts.deigvekt * 1000) : null;
      costHtml = `
        <div class="cost-summary">
          <div class="cost-main">Råvarekostnad: ${fmtKr(cost.totalCost)}</div>
          ${perKg ? `<div class="cost-sub">${fmtKr(perKg)} per kg deig</div>` : ''}
          ${cost.unknownCount > 0 ? `<div class="cost-sub" style="color:#856404;margin-top:4px">⚠ Mangler pris på ${cost.unknownCount} ingrediens${cost.unknownCount===1?'':'er'}: ${cost.unknownNames.join(', ')}</div>` : ''}
        </div>`;
    } else if (Object.keys(state.bakeryPrices).length === 0) {
      costHtml = `<div class="warn-box no-print">💰 Legg inn råvarepriser i bakeriet for å se kostnadsberegning.</div>`;
    } else {
      costHtml = `<div class="warn-box no-print">⚠ Ingen av ingrediensene har registrert pris.</div>`;
    }
  }

  const recipeBakeries = (r.bakeries || []).map(bid => state.bakeries.find(b => b.id === bid)).filter(Boolean);
  const tagsHtml = recipeBakeries.length > 0
    ? `<div style="margin-bottom:8px">${recipeBakeries.map(b => `<span class="recipe-bakery-tag">🥖 ${b.name}</span>`).join('')}</div>` : '';

  const remainingBakeries = state.bakeries.filter(b => !recipeBakeries.find(rb => rb.id === b.id));
  const bakeryActionsHtml = state.activeBakery || state.bakeries.length === 0 ? '' : `
    <div class="card no-print">
      <p style="font-weight:500;margin-bottom:8px">Bakerier</p>
      ${recipeBakeries.length > 0 ? recipeBakeries.map(b => `
        <div class="cat-row">
          <span style="font-size:14px">${b.name}</span>
          <button class="btn" style="padding:4px 10px;font-size:12px" onclick="removeRecipeFromBakery('${r.id}','${b.id}')">Fjern</button>
        </div>
      `).join('') : '<p class="muted" style="margin-bottom:8px">Ikke knyttet til noen bakerier.</p>'}
      ${remainingBakeries.length > 0 ? `
        <div style="display:flex;gap:8px;margin-top:8px">
          <select id="add-to-bakery-select">
            ${remainingBakeries.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
          </select>
          <button class="btn-primary" style="white-space:nowrap" onclick="addRecipeToSelectedBakery('${r.id}')">+ Tilføy</button>
        </div>
      ` : ''}
    </div>`;

  return `
    <div class="topbar no-print"><button class="btn" onclick="backFromRecipe()">← Tilbake</button>
    <div class="gap">
      <button class="btn" onclick="startEdit()">Rediger</button>
      <button class="btn no-print" onclick="window.print()">🖨 Skriv ut</button>
      <button class="btn-danger" onclick="confirmDelete()">Slett</button>
    </div></div>
    <p class="muted" style="margin-bottom:4px">${catName}</p>
    <h2 style="margin-bottom:8px">${r.name}</h2>
    ${tagsHtml}
    ${tabs}${imgs}
    ${bakePctSummaryHtml(pcts, showPct)}
    ${costHtml}
    ${v.notes?`<div class="info-box">${v.notes}</div>`:''}
    <div class="card"><p style="font-weight:500;margin-bottom:8px">Ingredienser</p>${ingHtml}</div>
    <div class="card"><p style="font-weight:500;margin-bottom:8px">Fremgangsmåte</p><pre>${v.steps || ''}</pre></div>
    ${bakeryActionsHtml}`;
}

function ingredientRowHtml(ing, idx, melTotal, showPct) {
  const roleOpts = ROLE_OPTIONS.map(r => `<option value="${r.id}" ${r.id===(ing.rolle||'')?'selected':''}>${r.label}</option>`).join('');
  let pctStr = '';
  if (showPct && melTotal > 0) {
    const p = ingredientPct(ing, melTotal);
    if (p !== null) pctStr = Math.round(p) + '%';
  }
  return `
    <div class="ing-row" data-idx="${idx}">
      <input type="text" class="ing-mengde" placeholder="Mengde" value="${ing.mengde !== null && ing.mengde !== undefined ? ing.mengde : ''}">
      <input type="text" class="ing-enhet" placeholder="Enhet" value="${ing.enhet || ''}">
      <input type="text" class="ing-navn" placeholder="Ingrediens" value="${ing.navn || ''}" data-idx="${idx}">
      <select class="ing-rolle">${roleOpts}</select>
      <span class="ing-pct">${pctStr}</span>
      <button type="button" class="ing-remove" onclick="removeIngredient(${idx})" title="Fjern">×</button>
    </div>
    <div class="ing-merknad">
      <input type="text" class="ing-merknad-input" placeholder="Merknad (f.eks. romtemperert, etter smak)" value="${ing.merknad || ''}">
    </div>`;
}

function editView() {
  const v = state.editData.versions[0];
  const imgs=(v.images||[]).map(img=>`<img class="recipe-img" src="${img}" alt="">`).join('');
  const catOptions=allCategories().map(c=>`<option value="${c.id}" ${state.editData.category===c.id?'selected':''}>${c.name}</option>`).join('');
  const ingList = v.ingredientsList || [];
  const showPct = shouldShowBakePct(state.editData.category);
  const pcts = calcBakePcts(ingList);
  const melTotal = pcts && pcts.melTotal ? pcts.melTotal : 0;
  const ingRowsHtml = ingList.map((ing, i) => ingredientRowHtml(ing, i, melTotal, showPct)).join('');
  const summaryHtml = bakePctSummaryHtml(pcts, showPct);
  const recipeBakeries = state.editData.bakeries || [];
  const bakeryCheckboxes = state.bakeries.length === 0 ? '' : `
    <div class="card">
      <p style="font-weight:500;margin-bottom:8px">Bakerier</p>
      <p class="muted" style="margin-bottom:8px">Velg hvilke bakerier denne oppskriften er aktuell for.</p>
      ${state.bakeries.map(b => `
        <div class="bakery-checkbox-row">
          <input type="checkbox" id="bk-${b.id}" ${recipeBakeries.includes(b.id)?'checked':''}>
          <label for="bk-${b.id}" style="margin:0;font-size:14px;color:#1a1a1a">${b.name}</label>
        </div>
      `).join('')}
    </div>`;
  return `
    <div class="topbar"><button class="btn" onclick="cancelEdit()">← Avbryt</button></div>
    <h2>${state.editData.name||'Ny oppskrift'}</h2>
    <div class="card">
      <p style="font-weight:500;margin-bottom:8px">Scan oppskrift fra bilde</p>
      <p class="muted" style="margin-bottom:10px">Ta bilde av en oppskrift – Claude leser den og fyller inn feltene automatisk.</p>
      <input type="file" id="scan-cam" accept="image/*" capture="environment" multiple style="display:none">
      <input type="file" id="scan-input" accept="image/*" multiple style="display:none">
      <div class="gap">
        <button class="btn" style="flex:1" onclick="document.getElementById('scan-cam').click()">📷 Ta bilde</button>
        <button class="btn" style="flex:1" onclick="document.getElementById('scan-input').click()">🖼 Last opp</button>
      </div>
    </div>
    <div class="card">
      <label>Navn</label><input id="e-name" class="${state.validationErrors.name?'input-error':''}" value="${state.editData.name}" placeholder="F.eks. Surdeigsbaguetter">
      <label>Kategori</label>
      <select id="e-cat" class="${state.validationErrors.category?'input-error':''}"><option value="">Velg kategori...</option>${catOptions}</select>
    </div>
    ${bakeryCheckboxes}
    <div class="card">
      <p class="muted" style="margin-bottom:8px">Versjon – ${fmt(v.date)}</p>
      <p style="font-weight:500;margin-bottom:8px">Ingredienser</p>
      ${summaryHtml}
      <div id="ing-container">${ingRowsHtml}</div>
      <button type="button" class="btn" style="margin-top:8px" onclick="addIngredient()">+ Legg til ingrediens</button>
      <label>Fremgangsmåte</label><textarea id="e-steps" rows="6">${v.steps || ''}</textarea>
      <label>Notater / justeringer</label><textarea id="e-notes" rows="3">${v.notes || ''}</textarea>
    </div>
    <div class="card">
      <p style="font-weight:500;margin-bottom:8px">Bilder av resultatet</p>
      ${imgs}
      <input type="file" id="img-input" accept="image/*" style="display:none">
      <input type="file" id="cam-input" accept="image/*" capture="environment" style="display:none">
      <div class="gap">
        <button class="btn" style="flex:1" onclick="document.getElementById('cam-input').click()">📷 Ta bilde</button>
        <button class="btn" style="flex:1" onclick="document.getElementById('img-input').click()">🖼 Last opp</button>
      </div>
    </div>
    ${state.statusMsg?`<p class="status">${state.statusMsg}</p>`:''}
    <button class="btn-primary" style="width:100%;margin-top:4px" onclick="handleSave()" ${state.loading?'disabled':''}>
      ${state.loading?'Lagrer...':'Lagre oppskrift'}</button>`;
}

// =====================================================================
// BIND-FUNKSJONER
// =====================================================================

function bindLogin() {
  document.getElementById('root').addEventListener('keydown', e => {
    if (e.key==='Enter' && state.loginMode==='email') doEmailLogin();
  });
}

function bindEdit() {
  document.getElementById('img-input').addEventListener('change', e=>handleImageFile(e.target.files[0]));
  document.getElementById('cam-input').addEventListener('change', e=>handleImageFile(e.target.files[0]));
  document.getElementById('scan-input').addEventListener('change', e=>addScanImages(Array.from(e.target.files)));
  document.getElementById('scan-cam').addEventListener('change', e=>addScanImages(Array.from(e.target.files)));
  const container = document.getElementById('ing-container');
  if (container) {
    container.addEventListener('input', (e) => {
      const cls = e.target.classList;
      if (cls && (cls.contains('ing-mengde') || cls.contains('ing-enhet'))) {
        saveFormState();
        clearTimeout(window.recalcTimer);
        window.recalcTimer = setTimeout(() => updateBakePctsInPlace(), 400);
      }
    });
    container.addEventListener('change', (e) => {
      if (e.target.tagName === 'SELECT' && e.target.classList.contains('ing-rolle')) {
        saveFormState();
        render();
      }
    });
    container.addEventListener('blur', (e) => {
      if (e.target.classList && e.target.classList.contains('ing-navn')) {
        const row = e.target.closest('.ing-row');
        if (!row) return;
        const roleSelect = row.querySelector('.ing-rolle');
        if (roleSelect && !roleSelect.value) {
          const role = lookupRole(e.target.value);
          if (role) { saveFormState(); render(); }
        }
      }
    }, true);
  }
  const catSelect = document.getElementById('e-cat');
  if (catSelect) {
    catSelect.addEventListener('change', () => {
      state.validationErrors.category = false;
      saveFormState(); render();
    });
  }
  const nameEl = document.getElementById('e-name');
  if (nameEl) {
    nameEl.addEventListener('input', () => {
      if (state.validationErrors.name) {
        state.validationErrors.name = false;
        nameEl.classList.remove('input-error');
      }
    });
  }
}

function updateBakePctsInPlace() {
  if (!state.editData) return;
  const ingList = state.editData.versions[0].ingredientsList || [];
  const showPct = shouldShowBakePct(state.editData.category);
  const pcts = calcBakePcts(ingList);
  const melTotal = pcts && pcts.melTotal ? pcts.melTotal : 0;
  const summary = document.querySelector('.bakepct-summary');
  if (summary) {
    const newSummary = bakePctSummaryHtml(pcts, showPct);
    if (newSummary) summary.outerHTML = newSummary;
    else summary.remove();
  } else if (pcts && (pcts.deigvekt > 0 || (showPct && pcts.hydrering))) {
    render(); return;
  }
  const rows = document.querySelectorAll('.ing-row');
  rows.forEach((row, i) => {
    const ing = ingList[i];
    if (!ing) return;
    const pctSpan = row.querySelector('.ing-pct');
    if (!pctSpan) return;
    let pctStr = '';
    if (showPct && melTotal > 0) {
      const p = ingredientPct(ing, melTotal);
      if (p !== null) pctStr = Math.round(p) + '%';
    }
    pctSpan.textContent = pctStr;
  });
}

function bindSettings() {
  const ci=document.getElementById('cover-input');
  if(ci) ci.addEventListener('change', async e=>{
    const file=e.target.files[0]; if(!file) return;
    setStatus('Laster opp forsidebilde...');
    const url=await uploadFile(file,`cover/cover_${Date.now()}.jpg`);
    state.coverImageUrl=url;
    await setDoc(doc(db,'settings','cover'),{url});
    setStatus('Forsidebilde lagret!');
    setTimeout(()=>{state.statusMsg='';render();},2000);
    render();
  });
  const emailEl = document.getElementById('new-user-email');
  if (emailEl) emailEl.addEventListener('input', () => {
    if (state.validationErrors.userEmail) { state.validationErrors.userEmail = false; emailEl.classList.remove('input-error'); }
  });
  const passEl = document.getElementById('new-user-pass');
  if (passEl) passEl.addEventListener('input', () => {
    if (state.validationErrors.userPass) { state.validationErrors.userPass = false; passEl.classList.remove('input-error'); }
  });
}

function bindRoles() {
  const search = document.getElementById('role-search');
  if (search) search.addEventListener('input', (e) => {
    state.roleSearch = e.target.value;
    const cursor = e.target.selectionStart;
    render();
    const newSearch = document.getElementById('role-search');
    if (newSearch) { newSearch.focus(); newSearch.setSelectionRange(cursor, cursor); }
  });
}

function bindPrices() {
  const search = document.getElementById('price-search');
  if (search) search.addEventListener('input', (e) => {
    state.priceSearch = e.target.value;
    const cursor = e.target.selectionStart;
    render();
    const newSearch = document.getElementById('price-search');
    if (newSearch) { newSearch.focus(); newSearch.setSelectionRange(cursor, cursor); }
  });
  const listSearch = document.getElementById('price-list-search');
  if (listSearch) listSearch.addEventListener('input', (e) => {
    state.priceListSearch = e.target.value;
    const cursor = e.target.selectionStart;
    render();
    const newListSearch = document.getElementById('price-list-search');
    if (newListSearch) { newListSearch.focus(); newListSearch.setSelectionRange(cursor, cursor); }
  });
}

function selectPriceIngredient(navn) {
  window._newPriceNavn = navn;
  state.priceSearch = '';
  render();
  setTimeout(() => {
    const el = document.getElementById('new-price-pris');
    if (el) el.focus();
  }, 50);
}

// =====================================================================
// HANDLER-FUNKSJONER
// =====================================================================

function setView(v){state.view=v;state.statusMsg='';if(v==='roles')state.roleSearch='';state.validationErrors={};render();}
function goHome(){state.activeCategory=null;state.activeBakery=null;state.bakeryPrices={};state.bakeryPlans=[];state.bakeryStandardTasks=[];state.view='home';render();}
function openRecipe(id){state.selected=id;state.selectedVersion=0;state.view='recipe';render();}
function selVer(i){state.selectedVersion=i;render();}
function setStatus(s){state.statusMsg=s;render();}
function selectCat(id){state.activeCategory=id;render();}

function backFromRecipe(){
  if (state.activeBakery) { state.view = 'bakery_recipes'; render(); }
  else { state.view='home'; render(); }
}

function cancelEdit() {
  if (state.activeBakery) { state.view = 'bakery_recipes'; }
  else { state.view = 'home'; }
  state.editData = null;
  render();
}

function emptyIngredient() {
  return { mengde: '', enhet: '', navn: '', merknad: '', rolle: '' };
}

function startNew() {
  state.validationErrors = {};
  const initialBakeries = state.activeBakery ? [state.activeBakery] : [];
  state.editData={
    id:`recipe_${Date.now()}`,
    name:'', category:'', bakeries: initialBakeries,
    versions:[{
      date:new Date().toISOString(), notes:'',
      ingredientsList:[ emptyIngredient() ],
      steps:'', images:[]
    }]
  };
  state.view='edit';render();
}

function startEdit() {
  state.validationErrors = {};
  if (window.recalcTimer) clearTimeout(window.recalcTimer);
  state.editData=JSON.parse(JSON.stringify(state.recipes.find(r=>r.id===state.selected)));
  if (!state.editData.versions[0].ingredientsList) state.editData.versions[0].ingredientsList = [ emptyIngredient() ];
  if (!Array.isArray(state.editData.bakeries)) state.editData.bakeries = [];
  state.editData.versions[0].ingredientsList.forEach(ing => { if (ing.rolle === undefined) ing.rolle = ''; });
  state.view='edit';render();
}

function addIngredient() {
  if (window.recalcTimer) clearTimeout(window.recalcTimer);
  saveFormState();
  state.editData.versions[0].ingredientsList.push(emptyIngredient());
  render();
}

function removeIngredient(idx) {
  if (window.recalcTimer) clearTimeout(window.recalcTimer);
  saveFormState();
  state.editData.versions[0].ingredientsList.splice(idx, 1);
  if (state.editData.versions[0].ingredientsList.length === 0) state.editData.versions[0].ingredientsList.push(emptyIngredient());
  render();
}

function saveFormState() {
  const n=document.getElementById('e-name');
  const c=document.getElementById('e-cat');
  const s=document.getElementById('e-steps');
  const nt=document.getElementById('e-notes');
  if(n)state.editData.name=n.value;
  if(c)state.editData.category=c.value;
  if(s)state.editData.versions[0].steps=s.value;
  if(nt)state.editData.versions[0].notes=nt.value;
  const checkedBakeries = [];
  state.bakeries.forEach(b => {
    const cb = document.getElementById('bk-' + b.id);
    if (cb && cb.checked) checkedBakeries.push(b.id);
  });
  state.editData.bakeries = checkedBakeries;
  const container = document.getElementById('ing-container');
  if (container) {
    const rows = container.querySelectorAll('.ing-row');
    const merknader = container.querySelectorAll('.ing-merknad-input');
    const newList = [];
    rows.forEach((row, i) => {
      const mengdeStr = row.querySelector('.ing-mengde').value.trim();
      const enhet = row.querySelector('.ing-enhet').value.trim();
      const navn = row.querySelector('.ing-navn').value.trim();
      const rolle = row.querySelector('.ing-rolle').value;
      const merknad = merknader[i] ? merknader[i].value.trim() : '';
      let mengde = null;
      if (mengdeStr !== '') {
        const num = parseFloat(mengdeStr.replace(',', '.'));
        mengde = isNaN(num) ? mengdeStr : num;
      }
      const finalRolle = rolle || lookupRole(navn);
      newList.push({ mengde, enhet, navn, merknad, rolle: finalRolle });
    });
    state.editData.versions[0].ingredientsList = newList;
  }
}

async function handleSave() {
  saveFormState();
  state.validationErrors = {};
  const missing = [];
  if (!state.editData.name.trim()) { missing.push('Navn'); state.validationErrors.name = true; }
  if (!state.editData.category) { missing.push('Kategori'); state.validationErrors.category = true; }
  if (missing.length > 0) {
    setStatus(`${missing.join(' og ')} må fylles inn før oppskriften kan lagres.`);
    render(); return;
  }
  state.editData.versions[0].ingredientsList = state.editData.versions[0].ingredientsList
    .filter(ing => ing.navn || ing.mengde || ing.enhet || ing.merknad);
  state.loading=true;setStatus('Lagrer...');
  await saveRecipeToDb(state.editData);
  state.loading=false;
  if (state.activeBakery) { state.view='bakery_recipes'; }
  else { state.view='home'; }
  state.editData=null;state.validationErrors={};render();
}

async function confirmDelete() {
  const r=state.recipes.find(x=>x.id===state.selected);
  if(!r||!confirm(`Vil du slette "${r.name}"?`)) return;
  await deleteRecipeFromDb(r.id);
  if (state.activeBakery) { state.view='bakery_recipes'; }
  else { state.view='home'; }
  render();
}

// =====================================================================
// KATEGORIER OG BAKERIER
// =====================================================================

async function saveApiKey() {
  const k=document.getElementById('akey-input').value.trim();
  if(!k){setStatus('Lim inn en API-nøkkel først.');return;}
  state.anthropicKey=k;
  await setDoc(doc(db,'settings','apikey'),{key:k});
  setStatus('API-nøkkel lagret!');
  setTimeout(()=>{state.statusMsg='';render();},2000);
}

async function addCustomCat() {
  const name=document.getElementById('new-cat-name').value.trim();
  if(!name){setStatus('Skriv inn et kategorinavn.');return;}
  const id='custom_'+name.toLowerCase().replace(/\s+/g,'_')+'_'+Date.now();
  const cat={id,name,icon:''};
  await setDoc(doc(db,'categories',id),cat);
  state.customCategories.push(cat);
  setStatus('Kategori lagt til!');
  setTimeout(()=>{state.statusMsg='';render();},1500);
  render();
}

async function deleteCustomCat(id) {
  if(!confirm('Slette denne kategorien?')) return;
  await deleteDoc(doc(db,'categories',id));
  state.customCategories=state.customCategories.filter(c=>c.id!==id);
  render();
}

async function addBakery() {
  const name = document.getElementById('new-bakery-name').value.trim();
  if (!name) { setStatus('Skriv inn et navn på bakeriet.'); return; }
  const id = bakeryId(name);
  await setDoc(doc(db, 'bakeries', id), { name, createdAt: new Date().toISOString() });
  await loadBakeries();
  setStatus(`Bakeri "${name}" opprettet.`);
  setTimeout(() => { state.statusMsg = ''; render(); }, 2000);
  render();
}

async function deleteBakery(id) {
  const b = state.bakeries.find(x => x.id === id);
  if (!b) return;
  if (!confirm(`Slette "${b.name}"? Oppskrifter mister bare taggen, ikke selve oppskriftene.`)) return;
  await deleteDoc(doc(db, 'bakeries', id));
  const affected = state.recipes.filter(r => Array.isArray(r.bakeries) && r.bakeries.includes(id));
  for (const r of affected) {
    const updated = { ...r, bakeries: r.bakeries.filter(bid => bid !== id) };
    await setDoc(doc(db, 'recipes', r.id), updated);
  }
  await Promise.all([loadBakeries(), loadRecipes()]);
  setStatus(`"${b.name}" slettet.`);
  setTimeout(() => { state.statusMsg = ''; render(); }, 2000);
  render();
}

async function enterBakery(id) {
  state.activeBakery = id;
  state.activeCategory = null;
  state.view = 'bakery_home';
  await Promise.all([loadBakeryPrices(id), loadBakeryPlans(id), loadBakeryStandardTasks(id)]);
  render();
}

function enterBakeryRecipes() { state.activeCategory = null; state.view = 'bakery_recipes'; render(); }
function exitBakeryRecipes() { state.activeCategory = null; state.view = 'bakery_home'; render(); }
function enterBakeryPrices() {
  state.priceSearch = ''; state.priceListSearch = ''; state.editingPriceName = null;
  window._newPriceNavn = ''; state.view = 'bakery_prices'; render();
}
function exitBakeryPrices() {
  state.priceSearch = ''; state.priceListSearch = ''; state.editingPriceName = null;
  state.view = 'bakery_home'; render();
}
function enterBakeryPlans() { state.view = 'bakery_plans'; render(); }
function exitBakeryPlans() { state.view = 'bakery_home'; render(); }

function exitBakery() {
  state.activeBakery = null; state.activeCategory = null;
  state.bakeryPrices = {}; state.bakeryPlans = []; state.bakeryStandardTasks = [];
  state.view = 'home'; render();
}

function moduleNotReady() {
  setStatus('Denne modulen er under utvikling.');
  setTimeout(() => { state.statusMsg = ''; render(); }, 2500);
}

async function addRecipeToSelectedBakery(recipeId) {
  const sel = document.getElementById('add-to-bakery-select');
  if (!sel) return;
  const bakeryIdVal = sel.value;
  const r = state.recipes.find(x => x.id === recipeId);
  if (!r) return;
  const newBakeries = Array.isArray(r.bakeries) ? [...r.bakeries] : [];
  if (!newBakeries.includes(bakeryIdVal)) newBakeries.push(bakeryIdVal);
  const updated = { ...r, bakeries: newBakeries };
  await setDoc(doc(db, 'recipes', recipeId), updated);
  await loadRecipes();
  render();
}

async function removeRecipeFromBakery(recipeId, bakeryIdVal) {
  const r = state.recipes.find(x => x.id === recipeId);
  if (!r) return;
  const newBakeries = (r.bakeries || []).filter(bid => bid !== bakeryIdVal);
  const updated = { ...r, bakeries: newBakeries };
  await setDoc(doc(db, 'recipes', recipeId), updated);
  await loadRecipes();
  render();
}

// =====================================================================
// RÅVAREPRISER
// =====================================================================

async function addBakeryPrice() {
  if (!state.activeBakery) return;
  const navn = document.getElementById('new-price-navn').value.trim().toLowerCase();
  const prisInput = document.getElementById('new-price-pris').value;
  const pakkeInput = document.getElementById('new-price-pakke').value;
  const pris = asNumber(prisInput);
  const pakkemengde = asNumber(pakkeInput);
  const enhet = document.getElementById('new-price-enhet').value;
  if (!navn) { setStatus('Velg eller skriv inn ingrediensen.'); return; }
  if (!hasNumberValue(prisInput)) { setStatus('Skriv inn pris. Bruk 0 hvis råvaren skal ha gratispris.'); return; }
  if (!hasNumberValue(pakkeInput)) { setStatus('Skriv inn pakkemengde, for eksempel 1 l, 1 kg eller 25 kg.'); return; }
  if (pakkemengde === 0) { setStatus('Pakkemengde kan ikke være 0.'); return; }
  const id = priceDocId(navn);
  await setDoc(doc(db, 'bakeries', state.activeBakery, 'prices', id), {
    navn, pris, pakkemengde, enhet, oppdatert: new Date().toISOString()
  });
  state.bakeryPrices[navn] = { pris, pakkemengde, enhet, oppdatert: new Date().toISOString() };
  window._newPriceNavn = '';
  state.priceSearch = '';
  state.priceListSearch = navn;
  setStatus(`Pris lagret for ${navn}.`);
  setTimeout(() => { state.statusMsg = ''; render(); }, 2000);
  render();
}

async function deleteBakeryPrice(navn) {
  if (!state.activeBakery) return;
  const id = priceDocId(navn);
  await deleteDoc(doc(db, 'bakeries', state.activeBakery, 'prices', id));
  delete state.bakeryPrices[navn];
  render();
}

function editBakeryPrice(navn) { state.editingPriceName = navn; state.statusMsg = ''; render(); }
function cancelEditBakeryPrice() { state.editingPriceName = null; state.statusMsg = ''; render(); }

async function saveBakeryPriceEdit(navn) {
  if (!state.activeBakery) return;
  const rowId = priceDocId(navn);
  const prisInput = document.getElementById(`edit-price-pris-${rowId}`)?.value;
  const pakkeInput = document.getElementById(`edit-price-pakke-${rowId}`)?.value;
  const pris = asNumber(prisInput);
  const pakkemengde = asNumber(pakkeInput);
  const enhet = document.getElementById(`edit-price-enhet-${rowId}`)?.value;
  if (!hasNumberValue(prisInput)) { setStatus('Skriv inn pris. Bruk 0 hvis råvaren skal ha gratispris.'); return; }
  if (!hasNumberValue(pakkeInput)) { setStatus('Skriv inn pakkemengde, for eksempel 1 l, 1 kg eller 25 kg.'); return; }
  if (pakkemengde === 0) { setStatus('Pakkemengde kan ikke være 0.'); return; }
  if (!enhet) { setStatus('Velg enhet.'); return; }
  const id = priceDocId(navn);
  const updated = { navn, pris, pakkemengde, enhet, oppdatert: new Date().toISOString() };
  await setDoc(doc(db, 'bakeries', state.activeBakery, 'prices', id), updated);
  state.bakeryPrices[navn] = { pris, pakkemengde, enhet, oppdatert: updated.oppdatert };
  state.editingPriceName = null;
  setStatus(`Pris oppdatert for ${navn}.`);
  setTimeout(() => { state.statusMsg = ''; render(); }, 2000);
  render();
}

// =====================================================================
// DAGSPLAN
// =====================================================================

function startNewPlan() {
  if (!state.activeBakery) return;
  state.activePlan = {
    id: planDocId(),
    dato: todayISO(),
    status: 'planlagt',
    elementer: [],
    opprettet: new Date().toISOString(),
    oppdatert: new Date().toISOString()
  };
  state.editingElementIdx = null;
  state.view = 'bakery_plan_edit';
  render();
}

function openPlan(planId) {
  const p = state.bakeryPlans.find(x => x.id === planId);
  if (!p) return;
  state.activePlan = JSON.parse(JSON.stringify(p));
  state.editingElementIdx = null;
  state.view = 'bakery_plan_edit';
  render();
}

function exitPlanEdit() {
  const dateEl = document.getElementById('plan-dato');
  if (dateEl && state.activePlan && state.activePlan.status !== 'gjennomført') {
    state.activePlan.dato = dateEl.value;
  }
  savePlan();
  state.activePlan = null;
  state.editingElementIdx = null;
  state.view = 'bakery_plans';
  render();
}

async function savePlan() {
  if (!state.activeBakery || !state.activePlan) return;
  const dateEl = document.getElementById('plan-dato');
  if (dateEl && state.activePlan.status !== 'gjennomført') {
    state.activePlan.dato = dateEl.value;
  }
  state.activePlan.oppdatert = new Date().toISOString();
  await setDoc(doc(db, 'bakeries', state.activeBakery, 'plans', state.activePlan.id), state.activePlan);
  await loadBakeryPlans(state.activeBakery);
}

async function deletePlan() {
  if (!state.activeBakery || !state.activePlan) return;
  if (!confirm('Slette denne dagsplanen?')) return;
  await deleteDoc(doc(db, 'bakeries', state.activeBakery, 'plans', state.activePlan.id));
  await loadBakeryPlans(state.activeBakery);
  state.activePlan = null;
  state.editingElementIdx = null;
  state.view = 'bakery_plans';
  render();
}

async function copyPlan() {
  if (!state.activeBakery || !state.activePlan) return;
  const newPlan = JSON.parse(JSON.stringify(state.activePlan));
  newPlan.id = planDocId();
  newPlan.dato = todayISO();
  newPlan.status = 'planlagt';
  newPlan.opprettet = new Date().toISOString();
  newPlan.oppdatert = new Date().toISOString();
  newPlan.elementer = (newPlan.elementer || []).map(el => {
    const copy = { ...el, gjort: false };
    delete copy.snapshot;
    return copy;
  });
  await setDoc(doc(db, 'bakeries', state.activeBakery, 'plans', newPlan.id), newPlan);
  await loadBakeryPlans(state.activeBakery);
  state.activePlan = newPlan;
  state.editingElementIdx = null;
  setStatus('Dagsplan kopiert. Du kan nå redigere kopien.');
  setTimeout(() => { state.statusMsg = ''; render(); }, 2500);
  render();
}

async function markPlanGjennomført() {
  if (!state.activePlan) return;
  if (!confirm('Marker som gjennomført? Oppskriftene fryses (snapshot lagres) og kan ikke endres etterpå.')) return;
  for (const el of state.activePlan.elementer || []) {
    if (el.type === 'oppskrift') {
      const r = state.recipes.find(x => x.id === el.recipeId);
      if (r) {
        const v = r.versions[0];
        const pcts = calcBakePcts(v.ingredientsList || []);
        el.snapshot = {
          name: r.name,
          category: r.category,
          ingredientsList: JSON.parse(JSON.stringify(v.ingredientsList || [])),
          deigvekt: pcts ? pcts.deigvekt : 0
        };
      }
    }
  }
  state.activePlan.status = 'gjennomført';
  await savePlan();
  render();
}

async function markPlanPlanlagt() {
  if (!state.activePlan) return;
  if (!confirm('Endre tilbake til planlagt? Snapshots beholdes, men live-data brukes igjen.')) return;
  state.activePlan.status = 'planlagt';
  await savePlan();
  render();
}

function addRecipeToPlan() {
  if (!state.activePlan) return;
  const sel = document.getElementById('add-recipe-select');
  if (!sel || !sel.value) return;
  const recipeId = sel.value;
  if (!state.activePlan.elementer) state.activePlan.elementer = [];
  state.activePlan.elementer.push({
    type: 'oppskrift',
    recipeId,
    skaleringMode: 'faktor',
    faktor: 1,
    malDeigvekt: '',
    produkter: [],
    gjort: false
  });
  savePlan();
  render();
}

async function addNewStandardTask() {
  const inp = document.getElementById('new-task-name');
  if (!inp) return;
  const navn = inp.value.trim();
  if (!navn) { setStatus('Skriv inn et oppgavenavn.'); return; }
  const id = 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  await setDoc(doc(db, 'bakeries', state.activeBakery, 'tasks', id), { navn });
  await loadBakeryStandardTasks(state.activeBakery);
  if (!state.activePlan.elementer) state.activePlan.elementer = [];
  state.activePlan.elementer.push({ type: 'oppgave', navn, gjort: false });
  await savePlan();
  render();
}

async function deleteStandardTask(taskId) {
  if (!confirm('Slett denne standardoppgaven fra biblioteket? Dagsplaner som allerede bruker den påvirkes ikke.')) return;
  await deleteDoc(doc(db, 'bakeries', state.activeBakery, 'tasks', taskId));
  await loadBakeryStandardTasks(state.activeBakery);
  render();
}

function addCheckedTasksToPlan() {
  if (!state.activePlan) return;
  const checkboxes = document.querySelectorAll('.standard-task-row input[type="checkbox"]:checked');
  if (checkboxes.length === 0) {
    setStatus('Hak av minst én oppgave først.');
    setTimeout(() => { state.statusMsg = ''; render(); }, 2000);
    return;
  }
  if (!state.activePlan.elementer) state.activePlan.elementer = [];
  checkboxes.forEach(cb => {
    const navn = cb.dataset.task;
    if (navn) {
      state.activePlan.elementer.push({ type: 'oppgave', navn, gjort: false });
    }
  });
  savePlan();
  render();
}

function toggleElementDone(idx) {
  if (!state.activePlan || !state.activePlan.elementer || !state.activePlan.elementer[idx]) return;
  if (state.activePlan.status === 'gjennomført') return;
  state.activePlan.elementer[idx].gjort = !state.activePlan.elementer[idx].gjort;
  savePlan();
  render();
}

function removeElement(idx) {
  if (!state.activePlan || !state.activePlan.elementer) return;
  if (state.activePlan.status === 'gjennomført') return;
  state.activePlan.elementer.splice(idx, 1);
  if (state.editingElementIdx === idx) state.editingElementIdx = null;
  savePlan();
  render();
}
function moveElement(idx, retning) {
  if (!state.activePlan || !state.activePlan.elementer) return;
  if (state.activePlan.status === 'gjennomført') return;
  const nyIdx = idx + retning;
  if (nyIdx < 0 || nyIdx >= state.activePlan.elementer.length) return;
  const el = state.activePlan.elementer;
  [el[idx], el[nyIdx]] = [el[nyIdx], el[idx]];
  // Hvis et element redigeres, følg det
  if (state.editingElementIdx === idx) state.editingElementIdx = nyIdx;
  else if (state.editingElementIdx === nyIdx) state.editingElementIdx = idx;
  savePlan();
  render();
}

function editElement(idx) {
  saveCurrentElementEdits();
  state.editingElementIdx = idx;
  const el = state.activePlan.elementer[idx];
  if (el.skaleringMode === 'produkter' && (!el.produkter || el.produkter.length === 0)) {
    el.produkter = [{ navn: '', antall: '', vektPerStk: '' }];
  }
  render();
}

function cancelEditElement() {
  saveCurrentElementEdits();
  state.editingElementIdx = null;
  savePlan();
  render();
}

function setScaleMode(idx, mode) {
  saveCurrentElementEdits();
  if (!state.activePlan || !state.activePlan.elementer[idx]) return;
  const el = state.activePlan.elementer[idx];
  el.skaleringMode = mode;
  if (mode === 'produkter' && (!el.produkter || el.produkter.length === 0)) {
    el.produkter = [{ navn: '', antall: '', vektPerStk: '' }];
  }
  if (mode === 'faktor' && !el.faktor) el.faktor = 1;
  render();
}

function updateScaleField(idx, field, value) {
  if (!state.activePlan || !state.activePlan.elementer[idx]) return;
  state.activePlan.elementer[idx][field] = value;
}

function updateProductField(idx, prodIdx, field, value) {
  if (!state.activePlan || !state.activePlan.elementer[idx]) return;
  if (!state.activePlan.elementer[idx].produkter) state.activePlan.elementer[idx].produkter = [];
  if (!state.activePlan.elementer[idx].produkter[prodIdx]) return;
  state.activePlan.elementer[idx].produkter[prodIdx][field] = value;
}

function addProductRow(idx) {
  saveCurrentElementEdits();
  if (!state.activePlan || !state.activePlan.elementer[idx]) return;
  if (!state.activePlan.elementer[idx].produkter) state.activePlan.elementer[idx].produkter = [];
  state.activePlan.elementer[idx].produkter.push({ navn: '', antall: '', vektPerStk: '' });
  render();
}

function removeProductRow(idx, prodIdx) {
  saveCurrentElementEdits();
  if (!state.activePlan || !state.activePlan.elementer[idx]) return;
  const prods = state.activePlan.elementer[idx].produkter || [];
  prods.splice(prodIdx, 1);
  savePlan();
  render();
}

function saveCurrentElementEdits() {
  if (state.editingElementIdx === null) return;
  const idx = state.editingElementIdx;
  if (!state.activePlan || !state.activePlan.elementer[idx]) return;
  const el = state.activePlan.elementer[idx];

  if (el.skaleringMode === 'faktor') {
    const inp = document.getElementById(`scale-faktor-${idx}`);
    if (inp) el.faktor = inp.value;
  }
  if (el.skaleringMode === 'vekt') {
    const inp = document.getElementById(`scale-malvekt-${idx}`);
    if (inp) el.malDeigvekt = inp.value;
  }
  if (el.skaleringMode === 'produkter') {
    const navnInputs = document.querySelectorAll(`#product-rows-${idx} .prod-navn`);
    const antallInputs = document.querySelectorAll(`#product-rows-${idx} .prod-antall`);
    const vektInputs = document.querySelectorAll(`#product-rows-${idx} .prod-vekt`);
    const newProds = [];
    navnInputs.forEach((inp, i) => {
      newProds.push({
        navn: inp.value,
        antall: antallInputs[i] ? antallInputs[i].value : '',
        vektPerStk: vektInputs[i] ? vektInputs[i].value : ''
      });
    });
    if (newProds.length > 0) el.produkter = newProds;
  }
}

// =====================================================================
// INGREDIENS-ADMIN
// =====================================================================

async function addIngredientRole() {
  const navn = document.getElementById('new-role-navn').value.trim();
  const rolle = document.getElementById('new-role-rolle').value;
  const tetthet = parseTetthet(document.getElementById('new-role-tetthet').value);
  if (!navn) { setStatus('Skriv inn et ingrediensnavn.'); return; }
  const navnLow = navn.toLowerCase();
  const id = ingredientRoleId(navn);
  await setDoc(doc(db, 'ingredient_roles', id), { navn: navnLow, rolle, tetthet });
  state.ingredientRoles[navnLow] = { rolle, tetthet };
  setStatus(`Lagt til "${navn}".`);
  setTimeout(() => { state.statusMsg = ''; render(); }, 2000);
  render();
}

async function deleteIngredientRole(navn) {
  if (!confirm(`Slette "${navn}" fra lista?`)) return;
  const id = ingredientRoleId(navn);
  await deleteDoc(doc(db, 'ingredient_roles', id));
  delete state.ingredientRoles[navn];
  render();
}

async function saveAllRoleEdits() {
  const rows = document.querySelectorAll('.role-row[data-navn]');
  let endret = 0;
  setStatus('Lagrer endringer...');
  for (const row of rows) {
    const original = row.querySelector('.role-navn').dataset.original;
    const nyttNavn = row.querySelector('.role-navn').value.trim().toLowerCase();
    const nyRolle = row.querySelector('.role-rolle').value;
    const nyTetthet = parseTetthet(row.querySelector('.role-tetthet').value);
    const originalData = state.ingredientRoles[original] || {};
    if (!nyttNavn) continue;
    if (nyttNavn !== original) {
      await deleteDoc(doc(db, 'ingredient_roles', ingredientRoleId(original)));
      delete state.ingredientRoles[original];
      await setDoc(doc(db, 'ingredient_roles', ingredientRoleId(nyttNavn)), { navn: nyttNavn, rolle: nyRolle, tetthet: nyTetthet });
      state.ingredientRoles[nyttNavn] = { rolle: nyRolle, tetthet: nyTetthet };
      endret++;
    } else if (nyRolle !== originalData.rolle || nyTetthet !== originalData.tetthet) {
      await setDoc(doc(db, 'ingredient_roles', ingredientRoleId(nyttNavn)), { navn: nyttNavn, rolle: nyRolle, tetthet: nyTetthet });
      state.ingredientRoles[nyttNavn] = { rolle: nyRolle, tetthet: nyTetthet };
      endret++;
    }
  }
  setStatus(endret === 0 ? 'Ingen endringer.' : `Lagret. ${endret} endring${endret===1?'':'er'}.`);
  setTimeout(() => { state.statusMsg = ''; render(); }, 2500);
}

// =====================================================================
// BILDER OG SCANNING
// =====================================================================

async function handleImageFile(file) {
  if(!file) return;
  saveFormState();
  setStatus('Laster opp bilde...');
  const url=await uploadFile(file,`images/${Date.now()}_${file.name}`);
  state.editData.versions[0].images=[...(state.editData.versions[0].images||[]),url];
  setStatus(''); render();
}

function toBase64(file){
  return new Promise((res,rej)=>{
    const img=new Image();
    img.onload=()=>{
      const maxDim=1600;
      let w=img.width, h=img.height;
      if(w>maxDim||h>maxDim){
        if(w>h){h=Math.round(h*maxDim/w);w=maxDim;}
        else{w=Math.round(w*maxDim/h);h=maxDim;}
      }
      const canvas=document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      const dataUrl=canvas.toDataURL('image/jpeg',0.85);
      res(dataUrl.split(',')[1]);
    };
    img.onerror=rej;
    img.src=URL.createObjectURL(file);
  });
}

async function addScanImages(files) {
  if (!files || files.length === 0) return;
  if (!state.scanBuffer) state.scanBuffer = [];
  setStatus('Forbereder bilder...');
  for (const f of files) {
    const b64 = await toBase64(f);
    state.scanBuffer.push('data:image/jpeg;base64,' + b64);
  }
  setStatus('');
  render();
}

function removeScanImage(idx) {
  if (!state.scanBuffer) return;
  state.scanBuffer.splice(idx, 1);
  render();
}

function clearScanBuffer() {
  state.scanBuffer = [];
  render();
}

async function sendScanBuffer() {
  if (!state.scanBuffer || state.scanBuffer.length === 0) {
    setStatus('Ingen bilder å sende.');
    return;
  }
  if (!state.anthropicKey) {
    setStatus('Legg inn Claude API-nøkkel i innstillinger først.');
    return;
  }
  saveFormState();
  setStatus(`Leser oppskrift fra ${state.scanBuffer.length} bilde${state.scanBuffer.length!==1?'r':''}...`);
  const b64List = state.scanBuffer.map(url => url.split(',')[1]);
  const fileCount = state.scanBuffer.length;
  const promptText = `Dette er ${fileCount>1?`${fileCount} bilder`:'et bilde'} av en oppskrift${fileCount>1?' (samme oppskrift fordelt over flere sider)':''}. Returner KUN gyldig JSON i nøyaktig dette formatet:

{
  "name": "Navn på oppskriften",
  "ingredientsList": [
    { "mengde": 500, "enhet": "g", "navn": "hvetemel", "merknad": "" },
    { "mengde": null, "enhet": "", "navn": "salt", "merknad": "etter smak" }
  ],
  "steps": "Hele fremgangsmåten som tekst",
  "notes": "Eventuelle ekstra notater fra oppskriften"
}

Regler for ingrediensene:
- Hver ingrediens skal være ett objekt med fire felt: mengde (tall eller null), enhet (string), navn (string), merknad (string).
- Bruk null for mengde hvis oppskriften ikke spesifiserer en mengde (f.eks. "salt etter smak").
- Bruk tom streng "" for enhet, navn eller merknad hvis ikke aktuelt.
- Vanlige enheter: g, kg, ml, dl, l, ts, ss, stk, pakke, knivsodd.
- Hvis det står beskrivelser som "romtemperert", "finhakket", "knust" osv., legg dem i merknad.
- Hvis mengden mangler men det står en kommentar (f.eks. "etter smak", "litt"), legg kommentaren i merknad og sett mengde=null.

Svar KUN med JSON, ingen annen tekst.`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'x-api-key':state.anthropicKey,'anthropic-version':'2023-06-01','content-type':'application/json','anthropic-dangerous-direct-browser-access':'true'},
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{role:'user', content:[
          ...b64List.map(b64 => ({type:'image', source:{type:'base64', media_type:'image/jpeg', data:b64}})),
          {type:'text', text:promptText}
        ]}]
      })
    });
    const data = await res.json();
    const rawText = data.content?.[0]?.text || '{}';
    const cleaned = rawText.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.name) state.editData.name = parsed.name;
    if (Array.isArray(parsed.ingredientsList)) {
      state.editData.versions[0].ingredientsList = parsed.ingredientsList.map(ing => {
        const navn = ing.navn || '';
        return {
          mengde: (ing.mengde === null || ing.mengde === undefined) ? null : ing.mengde,
          enhet: ing.enhet || '', navn, merknad: ing.merknad || '',
          rolle: lookupRole(navn)
        };
      });
    }
    if (parsed.steps) state.editData.versions[0].steps = parsed.steps;
    if (parsed.notes) state.editData.versions[0].notes = parsed.notes;
    state.scanBuffer = [];
    setStatus('Oppskrift lest! Sjekk og juster feltene.');
    render();
  } catch(e) {
    console.error('Scan-feil:', e);
    setStatus('Kunne ikke lese oppskriften. Prøv igjen.');
  }
}
async function scanRecipe(files) {
  if(!files || files.length===0) return;
  if(!state.anthropicKey){setStatus('Legg inn Claude API-nøkkel i innstillinger først.');return;}
  saveFormState();setStatus(`Leser oppskrift fra ${files.length} bilde${files.length!==1?'r':''}...`);
  const b64List = await Promise.all(files.map(f => toBase64(f)));
  const promptText = `Dette er ${files.length>1?`${files.length} bilder`:'et bilde'} av en oppskrift${files.length>1?' (samme oppskrift fordelt over flere sider)':''}. Returner KUN gyldig JSON i nøyaktig dette formatet:

{
  "name": "Navn på oppskriften",
  "ingredientsList": [
    { "mengde": 500, "enhet": "g", "navn": "hvetemel", "merknad": "" },
    { "mengde": null, "enhet": "", "navn": "salt", "merknad": "etter smak" }
  ],
  "steps": "Hele fremgangsmåten som tekst",
  "notes": "Eventuelle ekstra notater fra oppskriften"
}

Regler for ingrediensene:
- Hver ingrediens skal være ett objekt med fire felt: mengde (tall eller null), enhet (string), navn (string), merknad (string).
- Bruk null for mengde hvis oppskriften ikke spesifiserer en mengde (f.eks. "salt etter smak").
- Bruk tom streng "" for enhet, navn eller merknad hvis ikke aktuelt.
- Vanlige enheter: g, kg, ml, dl, l, ts, ss, stk, pakke, knivsodd.
- Hvis det står beskrivelser som "romtemperert", "finhakket", "knust" osv., legg dem i merknad.
- Hvis mengden mangler men det står en kommentar (f.eks. "etter smak", "litt"), legg kommentaren i merknad og sett mengde=null.

Svar KUN med JSON, ingen annen tekst.`;
  try {
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'x-api-key':state.anthropicKey,'anthropic-version':'2023-06-01','content-type':'application/json','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({
        model:'claude-haiku-4-5-20251001',
        max_tokens:2048,
        messages:[{role:'user',content:[
          ...b64List.map(b64 => ({type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}})),
          {type:'text',text:promptText}
        ]}]
      })
    });
    const data=await res.json();
    const rawText = data.content?.[0]?.text || '{}';
    const cleaned = rawText.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.name) state.editData.name = parsed.name;
    if (Array.isArray(parsed.ingredientsList)) {
      state.editData.versions[0].ingredientsList = parsed.ingredientsList.map(ing => {
        const navn = ing.navn || '';
        return {
          mengde: (ing.mengde === null || ing.mengde === undefined) ? null : ing.mengde,
          enhet: ing.enhet || '', navn, merknad: ing.merknad || '',
          rolle: lookupRole(navn)
        };
      });
    }
    if (parsed.steps) state.editData.versions[0].steps = parsed.steps;
    if (parsed.notes) state.editData.versions[0].notes = parsed.notes;
    setStatus('Oppskrift lest! Sjekk og juster feltene.');
    render();
  } catch(e) {
    console.error('Scan-feil:', e);
    setStatus('Kunne ikke lese oppskriften. Prøv igjen.');
  }
}

// =====================================================================
// AUTH-LISTENER
// =====================================================================

onAuthStateChanged(auth, async user => {
  if (user) {
    const allowed = await isEmailAllowed(user.email);
    if (!allowed) {
      await signOut(auth);
      state.currentUser = null;
      state.view = 'login';
      state.statusMsg = 'Denne kontoen har ikke tilgang. Kontakt eier.';
      state.recipes = [];
      state.customCategories = [];
      state.bakeries = [];
      render();
      return;
    }
    state.currentUser = user;
    state.loading = true;
    state.view = 'home';
    render();
    await Promise.all([
      loadRecipes(),
      loadCustomCategories(),
      loadAppSettings(),
      loadIngredientRoles(),
      loadBakeries()
    ]);
    state.loading = false;
    render();
  } else {
    state.currentUser = null;
    state.view = 'login';
    state.loginMode = 'choose';
    state.recipes = [];
    state.customCategories = [];
    state.bakeries = [];
    render();
  }
});

// =====================================================================
// EKSPONERING TIL window FOR onclick-HANDLERS I HTML
// =====================================================================

Object.assign(window,{
  doGoogleLogin, doEmailLogin, doSignOut, setView, goHome, openRecipe, selVer, setStatus, selectCat,
  backFromRecipe, cancelEdit, startNew, startEdit, handleSave, confirmDelete,
  addCustomCat, deleteCustomCat, saveApiKey, createNewUser,
  addIngredient, removeIngredient, addIngredientRole, deleteIngredientRole, saveAllRoleEdits,
  addBakery, deleteBakery, enterBakery, exitBakery,
  enterBakeryRecipes, exitBakeryRecipes, enterBakeryPrices, exitBakeryPrices,
  enterBakeryPlans, exitBakeryPlans,
  moduleNotReady, addRecipeToSelectedBakery, removeRecipeFromBakery,
  addBakeryPrice, deleteBakeryPrice, editBakeryPrice, cancelEditBakeryPrice, saveBakeryPriceEdit,
  selectPriceIngredient,
  startNewPlan, openPlan, exitPlanEdit, savePlan, deletePlan, copyPlan,
  markPlanGjennomført, markPlanPlanlagt,
  addRecipeToPlan, addNewStandardTask, deleteStandardTask, addCheckedTasksToPlan,
  toggleElementDone, removeElement, moveElement, editElement, cancelEditElement,
  addScanImages, removeScanImage, clearScanBuffer, sendScanBuffer,
 setScaleMode, updateScaleField, updateProductField, commitPlanEdit, commitAnd, printPlan, addProductRow, removeProductRow,
});

renderRef.fn = render;
