// =====================================================================
// Sentralt state-objekt for hele appen.
// Alle moduler importerer dette og leser/skriver direkte på state.X.
// =====================================================================

export const state = {
  // Bruker og data fra Firestore
  currentUser: null,
  recipes: [],
  customCategories: [],
  bakeries: [],
  ingredientRoles: {},
  ingredientAliases: {},
  ingRevisionSearch: '',
  ingRevisionEditing: null,
  ingRevisionEditCanonical: '',
  bakeryPrices: {},
  bakeryPlans: [],
  bakeryStandardTasks: [],
  coverImageUrl: null,
  anthropicKey: null,

  // Navigasjon og UI-state
  view: 'login',
  selected: null,
  selectedVersion: 0,
  editData: null,
  activePlan: null,
  editingElementIdx: null,
  loading: false,
  statusMsg: '',
  activeCategory: null,
  activeBakery: null,
  loginMode: 'choose',
  roleSearch: '',
  priceSearch: '',
  priceListSearch: '',
  editingPriceName: null,
  validationErrors: {},
};

// =====================================================================
// render() settes av main.js etter at alle views er importert.
// Andre moduler kan kalle render() via dette objektet.
// =====================================================================

export const renderRef = { fn: () => {} };

export function render() {
  renderRef.fn();
}
