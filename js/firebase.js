import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js';

const firebaseConfig = {
  apiKey: "AIzaSyC8cmkZQXfPBFPeFy4ShYqOdCHRqKmkIng",
  authDomain: "bakebok.firebaseapp.com",
  projectId: "bakebok",
  storageBucket: "bakebok.firebasestorage.app",
  messagingSenderId: "518882951454",
  appId: "1:518882951454:web:ce11e02c5a223f24aa890f",
  measurementId: "G-QF76VZH8MC"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'europe-west1');
export const googleProvider = new GoogleAuthProvider();
