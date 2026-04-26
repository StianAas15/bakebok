const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

exports.createUser = onCall({ region: "europe-west1" }, async (request) => {
  // Krev at kalleren er innlogget
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Du må være innlogget.");
  }

  const { email, password } = request.data;

  if (!email || !password) {
    throw new HttpsError("invalid-argument", "E-post og passord må fylles inn.");
  }

  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "Passordet må være minst 6 tegn.");
  }

  try {
    const newUser = await getAuth().createUser({ email, password });
    return { success: true, uid: newUser.uid, email: newUser.email };
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Denne e-postadressen finnes allerede.");
    }
    throw new HttpsError("internal", err.message);
  }
});
