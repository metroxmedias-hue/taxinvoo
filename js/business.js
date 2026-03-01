import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA5vhi43CcL_ff_NZLIN3BUxa0CAYOvwh8",
  authDomain: "metrox-taxinvo.firebaseapp.com",
  projectId: "metrox-taxinvo",
  storageBucket: "metrox-taxinvo.firebasestorage.app",
  messagingSenderId: "1089587049670",
  appId: "1:1089587049670:web:4f3b663c767762749853c7",
  measurementId: "G-8JVQCSZX0P"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById('business-form');
const errorEl = document.getElementById('form-error');

function setError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg || '';
  errorEl.style.display = msg ? 'block' : 'none';
}

function mockCodexCreateBusiness(payload) {
  const businessId = `biz_${Date.now()}`;
  return Promise.resolve({ status: 'success', business_id: businessId });
}

function formatFirestoreError(err) {
  const code = String(err?.code || '').trim();
  if (code === 'permission-denied') {
    return 'Permission denied by Firestore rules. Please allow create/write for your logged-in user.';
  }
  if (code === 'unauthenticated') {
    return 'Session expired. Please login again and retry.';
  }
  if (code === 'resource-exhausted' || code === 'invalid-argument') {
    return 'Business payload is too large for Firestore. Retry without logo and upload it later in Settings.';
  }
  const message = String(err?.message || '').trim();
  return message ? `Failed to save business: ${message}` : 'Failed to save business. Please retry.';
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'login.html';
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('');

  const businessName = document.getElementById('biz-name').value.trim();
  const gstin = document.getElementById('biz-gstin').value.trim();
  const state = document.getElementById('biz-state').value;
  const fyStart = document.getElementById('biz-fy-start').value || '';

  if (!businessName || !state) {
    setError('Please fill all required fields.');
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    setError('You must be logged in.');
    return;
  }

  const intentPayload = {
    intent: 'create_business',
    user_id: user.uid,
    business_name: businessName,
    gstin: gstin,
    state: state,
    financial_year_start: fyStart
  };

  let codexResponse;
  try {
    codexResponse = await mockCodexCreateBusiness(intentPayload);
  } catch (err) {
    setError('Failed to create business. Please try again.');
    return;
  }

  if (!codexResponse || codexResponse.status !== 'success') {
    setError('Business creation failed.');
    return;
  }

  try {
    const now = new Date();
    const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const businessPayload = {
      name: businessName,
      gstin: gstin || '',
      state,
      owner_uid: user.uid,
      current_plan: 'trial',
      subscription_status: 'trial',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      financial_year_start: fyStart || '',
      created_at: serverTimestamp()
    };
    const requestedBusinessId = String(codexResponse.business_id || '').trim();
    const candidateIds = Array.from(new Set([
      requestedBusinessId,
      `biz_${user.uid}`,
      user.uid
    ].filter(Boolean)));
    let businessId = '';
    let createErr = null;
    for (const candidateId of candidateIds) {
      try {
        await setDoc(doc(db, 'businesses', candidateId), businessPayload);
        businessId = candidateId;
        break;
      } catch (err) {
        createErr = err;
      }
    }
    if (!businessId) throw createErr || new Error('Unable to create business document.');

    await setDoc(doc(db, 'users', user.uid), { business_id: businessId }, { merge: true });

    console.log('BUSINESS CREATED:', businessId);
    window.location.href = 'index.html';
  } catch (err) {
    console.error('Business setup save failed:', err);
    setError(formatFirestoreError(err));
  }
});
