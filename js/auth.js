import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { signInWithPopup, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js';
import { auth, db, googleProvider, functions } from './firebase.js';
import { state, render } from './state.js';

// =====================================================================
// Hvitliste-sjekk
// =====================================================================

export async function isEmailAllowed(email) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  try {
    const docRef = doc(db, 'allowed_emails', normalized);
    const snap = await getDoc(docRef);
    return snap.exists();
  } catch (e) {
    console.error('Hvitliste-sjekk feilet:', e);
    return false;
  }
}

// =====================================================================
// Innlogging
// =====================================================================

export async function doGoogleLogin() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    state.statusMsg = 'Innlogging feilet. Prøv igjen.';
    render();
  }
}

export async function doEmailLogin() {
  const email = document.getElementById('l-email')?.value.trim();
  const pass = document.getElementById('l-pass')?.value;
  if (!email || !pass) {
    state.statusMsg = 'Fyll inn e-post og passord.';
    render();
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    state.statusMsg = 'Feil e-post eller passord.';
    render();
  }
}

export async function doSignOut() {
  await signOut(auth);
}

// =====================================================================
// Opprett ny bruker (via Cloud Function)
// =====================================================================

export async function createNewUser() {
  const emailEl = document.getElementById('new-user-email');
  const passEl = document.getElementById('new-user-pass');
  const email = emailEl.value.trim();
  const pass = passEl.value;
  state.validationErrors.userEmail = false;
  state.validationErrors.userPass = false;
  const missing = [];
  if (!email) { missing.push('e-post'); state.validationErrors.userEmail = true; }
  if (!pass) { missing.push('passord'); state.validationErrors.userPass = true; }
  if (missing.length > 0) {
    state.statusMsg = `Fyll inn ${missing.join(' og ')}.`;
    render();
    return;
  }
  if (pass.length < 6) {
    state.validationErrors.userPass = true;
    state.statusMsg = 'Passordet må være minst 6 tegn.';
    render();
    return;
  }
  state.statusMsg = 'Oppretter bruker...';
  render();
  try {
    const createUser = httpsCallable(functions, 'createUser');
    const result = await createUser({ email, password: pass });
    state.statusMsg = `Bruker opprettet: ${result.data.email}`;
    state.validationErrors = {};
    render();
    setTimeout(() => { state.statusMsg = ''; render(); }, 3000);
  } catch (err) {
    state.statusMsg = 'Feil: ' + (err.message || 'Kunne ikke opprette bruker.');
    render();
  }
}
