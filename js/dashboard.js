import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const trialBanner = document.getElementById('trial-banner');
const trialEnded = document.getElementById('trial-ended');
const trialDays = document.getElementById('trial-days');
const businessName = document.getElementById('business-name');
const emptyState = document.getElementById('empty-state');
const createFirstInvoice = document.getElementById('create-first-invoice');

function show(el, visible) {
  if (!el) return;
  el.style.display = visible ? 'flex' : 'none';
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log('No auth → redirect to login');
    window.location.href = 'login.html';
    return;
  }
  console.log('AUTH OK:', user.uid);
  const userRef = doc(db, 'users', user.uid);
  let userSnap;
  try {
    userSnap = await getDoc(userRef);
  } catch (err) {
    console.error('User fetch failed:', err);
    console.log('No auth → redirect to login');
    window.location.href = 'login.html';
    return;
  }
  if (!userSnap.exists()) {
    console.log('No business → redirect to business-setup');
    window.location.href = 'business-setup.html';
    return;
  }

  const userData = userSnap.data();
  if (!userData.business_id) {
    console.log('No business → redirect to business-setup');
    window.location.href = 'business-setup.html';
    return;
  }
  const bizRef = doc(db, 'businesses', userData.business_id);
  let bizSnap;
  try {
    bizSnap = await getDoc(bizRef);
  } catch (err) {
    console.error('Business fetch failed:', err);
    console.log('No business → redirect to business-setup');
    window.location.href = 'business-setup.html';
    return;
  }
  if (!bizSnap.exists()) {
    console.log('No business → redirect to business-setup');
    window.location.href = 'business-setup.html';
    return;
  }

  const bizData = bizSnap.data();
  if (businessName) businessName.textContent = bizData.name || 'Your Business';
  const plan = (bizData.current_plan || 'trial').toLowerCase();
  const status = (bizData.subscription_status || (plan === 'trial' ? 'trial' : 'active')).toLowerCase();
  const trialEndsAt = bizData.trial_ends_at?.toDate ? bizData.trial_ends_at.toDate() : (bizData.trial_ends_at ? new Date(bizData.trial_ends_at) : null);
  const now = new Date();
  let daysLeft = 0;
  if (trialEndsAt) {
    daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  if (plan === 'trial' && status === 'trial') {
    if (trialDays) trialDays.textContent = String(daysLeft || 0);
    show(trialBanner, true);
    if (trialEndsAt && daysLeft <= 0) {
      console.log('Trial expired → feedback access remains unlocked');
      show(trialBanner, false);
      show(trialEnded, false);
      if (createFirstInvoice) createFirstInvoice.disabled = false;
    }
  } else if (status !== 'active') {
    console.log('Plan inactive → feedback access remains unlocked');
    show(trialEnded, false);
    if (createFirstInvoice) createFirstInvoice.disabled = false;
  } else {
    console.log('Plan active → full access');
  }

  const invQuery = query(collection(db, 'invoices'), where('business_id', '==', userData.business_id));
  const invSnap = await getDocs(invQuery);

  if (invSnap.empty) {
    show(emptyState, true);
    if (emptyState) emptyState.classList.add('fullscreen');
    document.body.classList.add('welcome-full');
  }
});

if (createFirstInvoice) {
  createFirstInvoice.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}
