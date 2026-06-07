import { collection, doc, setDoc, getDocs, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js';
import { db, storage } from './firebase.js';
import { state } from './state.js';

// =====================================================================
// Lasting fra Firestore
// =====================================================================

export async function loadRecipes() {
  const snap = await getDocs(collection(db, 'recipes'));
  state.recipes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.versions[0].date) - new Date(a.versions[0].date));
}

export async function loadCustomCategories() {
  const snap = await getDocs(collection(db, 'categories'));
  state.customCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function loadBakeries() {
  const snap = await getDocs(collection(db, 'bakeries'));
  state.bakeries = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}

export async function loadBakeryPrices(bakeryId) {
  state.bakeryPrices = {};
  if (!bakeryId) return;
  const snap = await getDocs(collection(db, 'bakeries', bakeryId, 'prices'));
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.navn) {
      state.bakeryPrices[data.navn.toLowerCase()] = {
        pris: data.pris,
        pakkemengde: data.pakkemengde,
        enhet: data.enhet,
        oppdatert: data.oppdatert,
      };
    }
  });
}

export async function loadBakeryPlans(bakeryId) {
  state.bakeryPlans = [];
  if (!bakeryId) return;
  const snap = await getDocs(collection(db, 'bakeries', bakeryId, 'plans'));
  state.bakeryPlans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function loadBakeryStandardTasks(bakeryId) {
  state.bakeryStandardTasks = [];
  if (!bakeryId) return;
  const snap = await getDocs(collection(db, 'bakeries', bakeryId, 'tasks'));
  state.bakeryStandardTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
}

export async function loadAppSettings() {
  const snap = await getDocs(collection(db, 'settings'));
  snap.docs.forEach(d => {
    if (d.id === 'apikey') state.anthropicKey = d.data().key;
    if (d.id === 'cover') state.coverImageUrl = d.data().url;
  });
}

export async function loadMasterIngredients() {
  const snap = await getDocs(collection(db, 'masterIngredients'));
  state.masterIngredients = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}

export async function loadIngredientAliases() {
  const snap = await getDocs(collection(db, 'ingredientAliases'));
  state.ingredientAliases = {};
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.normalizedAlias) state.ingredientAliases[data.normalizedAlias] = { id: d.id, ...data };
  });
}

export async function saveMasterIngredient(master) {
  await setDoc(doc(db, 'masterIngredients', master.id), master);
  await loadMasterIngredients();
}

export async function saveIngredientAlias(alias) {
  await setDoc(doc(db, 'ingredientAliases', alias.id), alias);
  await loadIngredientAliases();
}

export async function deleteIngredientAlias(id) {
  await deleteDoc(doc(db, 'ingredientAliases', id));
  await loadIngredientAliases();
}

export async function loadIngredientRoles() {
  const snap = await getDocs(collection(db, 'ingredient_roles'));
  state.ingredientRoles = {};
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.navn && data.rolle !== undefined) {
      state.ingredientRoles[data.navn.toLowerCase()] = {
        rolle: data.rolle,
        tetthet: (data.tetthet === undefined) ? null : data.tetthet
      };
    }
  });
}

// =====================================================================
// Lagring og sletting
// =====================================================================

export async function saveRecipeToDb(recipe) {
  await setDoc(doc(db, 'recipes', recipe.id), recipe);
  await loadRecipes();
}

export async function deleteRecipeFromDb(id) {
  await deleteDoc(doc(db, 'recipes', id));
  await loadRecipes();
}

// =====================================================================
// Filopplasting til Storage
// =====================================================================

export async function uploadFile(file, path) {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
