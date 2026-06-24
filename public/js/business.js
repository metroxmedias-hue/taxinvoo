import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { userDocPath } from "./firestore-paths.js";
import { createOrResolveBusinessV2, ensureBusinessRootBootstrapDocs } from "./business-v2.js?v=20260624-1";
import {
  ensureTrialSubscription,
  ensureUserRecord,
  linkUserToBusiness
} from "./subscription.js";

const firebaseConfig = {
  apiKey: "AIzaSyA5vhi43CcL_ff_NZLIN3BUxa0CAYOvwh8",
  authDomain: "metrox-taxinvo.firebaseapp.com",
  projectId: "metrox-taxinvo",
  storageBucket: "metrox-taxinvo.firebasestorage.app",
  messagingSenderId: "1089587049670",
  appId: "1:1089587049670:web:4f3b663c767762749853c7",
  measurementId: "G-8JVQCSZX0P"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById('business-form');
const errorEl = document.getElementById('form-error');
const MAX_TEXT = {
  name: 120,
  gstin: 32,
  state: 80,
  fy: 20
};

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
  const message = String(err?.message || '').trim();
  if (code || message) {
    return code ? `${code}: ${message || 'Firestore operation failed.'}` : message;
  }
  return 'Firestore operation failed.';
}

function safeText(value, maxLen) {
  return String(value || '').trim().slice(0, maxLen);
}

function safeDateInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  if (!user.emailVerified) {
    window.location.href = 'verify-email.html';
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('');

  const businessName = safeText(document.getElementById('biz-name').value, MAX_TEXT.name);
  const gstin = safeText(document.getElementById('biz-gstin').value, MAX_TEXT.gstin);
  const state = safeText(document.getElementById('biz-state').value, MAX_TEXT.state);
  const fyStart = safeDateInput(document.getElementById('biz-fy-start').value || '').slice(0, MAX_TEXT.fy);

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
    await ensureBusinessRootBootstrapDocs();
    const now = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(now.getDate() + 3);
    const businessPayload = {
      name: businessName,
      gstin: gstin || '',
      state,
      invoice_count: 0,
      setup_completed: true,
      trial_starts_at: now.toISOString(),
      plan_type: 'trial',
      plan_status: 'active',
      is_active: true,
      current_plan: 'trial',
      subscription_status: 'active',
      trial_ends_at: trialEnd.toISOString(),
      financial_year_start: fyStart || '',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };
    const business = await createOrResolveBusinessV2(user, businessPayload);
    const businessId = String(business?.businessId || business?.id || '').trim();
    if (!businessId) throw new Error('Unable to create business document.');

    await ensureUserRecord(user, { role: 'owner' });
    await ensureTrialSubscription(user.uid);
    await linkUserToBusiness(user.uid, businessId, user.uid);
    await setDoc(doc(db, ...userDocPath(user.uid)), { business_id: businessId, business_owner_uid: user.uid, user_id: user.uid, email: user.email || '' }, { merge: true });

    console.log('BUSINESS CREATED:', businessId);
    window.location.href = '../app/index.html';
  } catch (err) {
    console.error('Business setup save failed:', err);
    setError(formatFirestoreError(err));
  }
});
