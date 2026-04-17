import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, getDocsFromServer, addDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { businessStateDocPath, invoicesColPath, ledgerColPath } from "./firestore-paths.js";
import {
  checkAccess,
  canCreateInvoice,
  getPlanFeatures,
  getUserAccessContext,
  incrementInvoiceUsage,
  isBusinessSetupComplete,
  syncBusinessPlanStatus,
  TRIAL_EXPIRED_MESSAGE,
  syncSubscriptionStatus,
  trialDaysLeft
} from "./subscription.js";

const form = document.getElementById('invoice-form');
const customerEl = document.getElementById('inv-customer');
const typeEl = document.getElementById('inv-type');
const amountEl = document.getElementById('inv-amount');
const gstEl = document.getElementById('inv-gst');
const gstAmountEl = document.getElementById('gst-amount');
const totalAmountEl = document.getElementById('total-amount');
const saveBtn = document.getElementById('save-invoice');
const trialMsg = document.getElementById('trial-message');
const errorEl = document.getElementById('form-error');
const subscriptionBanner = document.getElementById('subscription-banner');
const featureLockModal = document.getElementById('feature-lock-modal');
const featureLockTitle = document.getElementById('feature-lock-title');
const featureLockMessage = document.getElementById('feature-lock-message');
const featureLockClose = document.getElementById('feature-lock-close');

let businessId = null;
let businessOwnerUid = null;
let accessContext = null;
window.APP_ACCESS = typeof window.APP_ACCESS === 'boolean' ? window.APP_ACCESS : true;
window.APP_FEATURES = window.APP_FEATURES || getPlanFeatures('trial');

function installGlobalAccessGuards() {
  if (window.__appAccessGuardsInstalled) return;
  window.__appAccessGuardsInstalled = true;

  document.addEventListener('click', (e) => {
    if (window.APP_ACCESS) return;
    const target = e?.target?.closest?.('button, a');
    if (!target) return;
    if (isAllowedWhenLocked(target)) return;
    e.preventDefault();
    alert('Trial expired. Please upgrade.');
  }, true);

  document.addEventListener('submit', (e) => {
    if (window.APP_ACCESS) return;
    if (!e?.target?.closest?.('form')) return;
    e.preventDefault();
    alert('Trial expired. Cannot submit.');
  }, true);

  document.querySelectorAll('form').forEach((formEl) => {
    if (formEl.dataset.softLockSubmitBound === '1') return;
    formEl.dataset.softLockSubmitBound = '1';
    formEl.addEventListener('submit', (e) => {
      if (window.APP_ACCESS) return;
      e.preventDefault();
      alert('Trial expired. Cannot submit.');
    });
  });
}

function isAllowedWhenLocked(target) {
  const el = target?.closest?.('button, a');
  if (!el) return false;
  if (el.closest('[data-allow-when-locked="true"]')) return true;
  if (el.hasAttribute('data-billing-cycle') || el.hasAttribute('data-plan-action')) return true;
  const id = String(el.id || '').toLowerCase();
  if ([
    'settings-back-dashboard',
    'upgrade-cta',
    'settings-buy-plan-btn',
    'settings-banner-upgrade-cta',
    'settings-upgrade-btn',
  ].includes(id)) return true;
  const href = String(el.getAttribute('href') || '').toLowerCase();
  if (href.includes('pricing') || href.includes('index.html') || href.includes('#/dashboard')) return true;
  const onclick = String(el.getAttribute('onclick') || '').toLowerCase();
  if (onclick.includes('pricing') || onclick.includes('index.html')) return true;
  const text = String(el.textContent || '').toLowerCase();
  return text.includes('upgrade') || text.includes('pricing') || text.includes('back to dashboard') || text.includes('start free trial') || text.includes('monthly') || text.includes('yearly');
}

function showExpiredBanner() {
  if (document.getElementById('trial-soft-lock-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'trial-soft-lock-banner';
  banner.innerHTML = `
    <div style="
      background: #fee2e2;
      color: #991b1b;
      padding: 12px;
      text-align: center;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 9999;
    ">
      🚫 Your trial has expired. Upgrade to continue using features.
      <button data-allow-when-locked="true" onclick="window.location.href='pricing.html'" style="
        margin-left: 10px;
        padding: 6px 12px;
        background: #4F46E5;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      ">
        Upgrade
      </button>
    </div>
  `;
  document.body.prepend(banner);
}

function applySoftLockGuards() {
  if (window.APP_ACCESS) return;
  document.querySelectorAll('input, select, textarea, button').forEach((el) => {
    if (el.matches('button') && isAllowedWhenLocked(el)) return;
    el.disabled = true;
  });
}

installGlobalAccessGuards();

async function loadBusiness(userData) {
  const ownerUid = String(userData?.business_owner_uid || userData?.user_id || auth.currentUser?.uid || '').trim();
  if (!ownerUid) return null;
  const expectedBusinessId = String(userData?.business_id || '').trim();
  const ref = collection(db, 'users', ownerUid, 'businesses');
  let snap = null;
  try {
    snap = await getDocsFromServer(ref);
  } catch (_) {
    snap = await getDocs(ref);
  }
  if (!snap || snap.empty) return null;
  const businessDoc = snap.docs.find((row) => row.id === expectedBusinessId) || snap.docs[0];
  const businessData = { ...(businessDoc.data() || {}), business_id: businessDoc.id };
  const features = getPlanFeatures(businessData.plan_type);
  window.businessData = businessData;
  window.APP_FEATURES = features;
  const hasAccess = checkAccess(businessData);
  window.APP_ACCESS = hasAccess;
  console.log('🔥 CORRECT BUSINESS:', businessData);
  if (!hasAccess) showExpiredBanner();
  return { businessId: businessDoc.id, businessData };
}

function setError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg || '';
  errorEl.style.display = msg ? 'block' : 'none';
}

function disableInvoiceButton(message = 'Your plan does not include invoice creation.') {
  if (saveBtn) saveBtn.disabled = true;
  setError(message);
}

async function syncInvoiceToCloudState(invoiceRefId, payload) {
  if (!businessId || !businessOwnerUid || !auth.currentUser) return;
  const stateRef = doc(db, ...businessStateDocPath(businessOwnerUid, businessId));
  const stateSnap = await getDoc(stateRef);
  const cloud = stateSnap.exists() ? (stateSnap.data().data || {}) : {};
  const nextState = {
    ...cloud,
    invoices: Array.isArray(cloud.invoices) ? [...cloud.invoices] : [],
    payments: Array.isArray(cloud.payments) ? [...cloud.payments] : [],
    supplierPayments: Array.isArray(cloud.supplierPayments) ? [...cloud.supplierPayments] : [],
    expenses: Array.isArray(cloud.expenses) ? [...cloud.expenses] : [],
    purchases: Array.isArray(cloud.purchases) ? [...cloud.purchases] : [],
    customers: cloud.customers && typeof cloud.customers === 'object' ? { ...cloud.customers } : {},
    company: cloud.company && typeof cloud.company === 'object' ? { ...cloud.company } : {}
  };

  const exists = nextState.invoices.some((inv) => inv.firestoreId === invoiceRefId || inv.id === invoiceRefId);
  if (!exists) {
    nextState.invoices.push(payload.invoice);
  }
  nextState.customers[payload.customerName] = {
    ...(nextState.customers[payload.customerName] || {}),
    name: payload.customerName
  };

  await setDoc(stateRef, {
    data: nextState,
    updated_at: serverTimestamp()
  }, { merge: true });

  try {
    const serialized = JSON.stringify(nextState);
    localStorage.setItem('metrox_taxinvoo_demo_state', serialized);
    localStorage.setItem('metrox_taxinvoo_demo_state_backup', serialized);
  } catch (_) {}
}

function calcTotals() {
  const amount = Number(amountEl.value) || 0;
  const gstPct = typeEl.value === 'gst' ? Number(gstEl.value) : 0;
  const gstAmt = amount * (gstPct / 100);
  const total = amount + gstAmt;
  if (gstAmountEl) gstAmountEl.textContent = `₹${gstAmt.toFixed(2)}`;
  if (totalAmountEl) totalAmountEl.textContent = `₹${total.toFixed(2)}`;
}

typeEl.addEventListener('change', () => {
  gstEl.disabled = typeEl.value !== 'gst';
  if (typeEl.value !== 'gst') gstEl.value = '0';
  calcTotals();
});
amountEl.addEventListener('input', calcTotals);
gstEl.addEventListener('change', calcTotals);

function showSubscriptionBanner(message, type = "info") {
  if (!subscriptionBanner) return;
  subscriptionBanner.textContent = message || "";
  subscriptionBanner.classList.toggle("warn", type === "warn");
  subscriptionBanner.style.display = message ? "block" : "none";
}

function openLockModal(title, message) {
  if (!featureLockModal) return;
  if (featureLockTitle) featureLockTitle.textContent = title || "Feature locked";
  if (featureLockMessage) featureLockMessage.textContent = message || "Upgrade to continue.";
  featureLockModal.classList.add("open");
}

function closeLockModal() {
  if (!featureLockModal) return;
  featureLockModal.classList.remove("open");
}

function applyAccessUI() {
  if (!accessContext) return;
  const sub = accessContext.subscription || {};
  const status = String(sub.status || "").toLowerCase();
  const plan = String(sub.plan || "trial").toLowerCase();

  if (plan === "trial" && (status === "active" || status === "grace")) {
    const days = trialDaysLeft(sub);
    showSubscriptionBanner(`Your trial ends in ${days} day${days === 1 ? "" : "s"}.`);
  } else if (status === "expired") {
    showSubscriptionBanner("Your trial has expired. Upgrade to continue.", "warn");
  } else {
    showSubscriptionBanner("");
  }

  if (saveBtn) {
    saveBtn.disabled = status === "expired" || !window.APP_FEATURES?.invoices;
  }

  if (trialMsg) {
    trialMsg.style.display = "none";
    trialMsg.textContent = "";
  }
  if (!window.APP_FEATURES?.invoices) {
    setError("Your plan does not include invoice creation.");
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  if (!user.emailVerified) {
    window.location.href = 'verify-email.html';
    return;
  }
  await syncSubscriptionStatus(user.uid);
  await syncBusinessPlanStatus(user.uid);
  accessContext = await getUserAccessContext(user.uid);
  const userData = accessContext?.user || null;
  const loadedBusiness = await loadBusiness(userData);
  const business = loadedBusiness?.businessData || null;

  if (!userData || !userData.business_id) {
    window.location.href = 'business-setup.html';
    return;
  }
  if (!isBusinessSetupComplete(business)) {
    window.location.href = 'business-setup.html';
    return;
  }
  const hasAccess = checkAccess(business);
  window.APP_ACCESS = hasAccess;
  if (!window.APP_FEATURES?.invoices) {
    disableInvoiceButton();
  }
  if (!hasAccess) {
    showExpiredBanner();
    applySoftLockGuards();
    setError(TRIAL_EXPIRED_MESSAGE);
    if (saveBtn) saveBtn.disabled = true;
  }

  businessId = String(loadedBusiness?.businessId || userData.business_id || '').trim();
  businessOwnerUid = String(userData.business_owner_uid || user.uid).trim();
  applyAccessUI();
  calcTotals();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('');
  if (!businessId) return;
  if (!window.APP_ACCESS) {
    setError(TRIAL_EXPIRED_MESSAGE);
    return;
  }
  if (!window.APP_FEATURES?.invoices) {
    disableInvoiceButton();
    return;
  }

  if (!accessContext) {
    setError('Subscription check pending. Please retry.');
    return;
  }

  if (!canCreateInvoice(accessContext)) {
    const status = String(accessContext?.subscription?.status || "").toLowerCase();
    if (status === "expired") {
      openLockModal("Trial expired", "Your trial has expired. Upgrade to continue creating invoices.");
      return;
    }
    openLockModal("Invoice limit reached", "You reached your limit. Upgrade for unlimited access.");
    return;
  }

  const customer = customerEl.value.trim();
  const invoiceType = typeEl.value;
  const amount = Number(amountEl.value);
  const gstPct = invoiceType === 'gst' ? Number(gstEl.value) : 0;
  if (!customer || !Number.isFinite(amount) || amount <= 0) {
    setError('Please fill all required fields.');
    return;
  }

  const gstAmount = amount * (gstPct / 100);
  const totalAmount = amount + gstAmount;

  try {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const invoiceRef = await addDoc(collection(db, ...invoicesColPath(businessOwnerUid, businessId)), {
      business_id: businessId,
      customer_name: customer,
      invoice_type: invoiceType,
      amount,
      gst_percentage: gstPct,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      amount_paid: 0,
      status: 'unpaid',
      created_at: serverTimestamp()
    });

    await addDoc(collection(db, ...ledgerColPath(businessOwnerUid, businessId)), {
      business_id: businessId,
      type: 'invoice',
      reference_id: invoiceRef.id,
      amount: totalAmount,
      balance: 0,
      date: serverTimestamp()
    });

    const nowIso = new Date().toISOString();
    const appInvoice = {
      id: invoiceRef.id,
      firestoreId: invoiceRef.id,
      customer,
      customerDetails: {},
      items: [{ description: 'Item', hsn: '', sac: '', qty: 1, price: amount, total: amount }],
      type: invoiceType,
      supply: 'intra',
      rate: gstPct,
      taxable: amount,
      cgst: invoiceType === 'gst' ? gstAmount / 2 : 0,
      sgst: invoiceType === 'gst' ? gstAmount / 2 : 0,
      igst: 0,
      total: totalAmount,
      roundOff: 0,
      paidAmount: 0,
      createdAt: nowIso,
      notes: '',
      status: 'unpaid'
    };

    await syncInvoiceToCloudState(invoiceRef.id, {
      invoice: appInvoice,
      customerName: customer
    });
    await incrementInvoiceUsage(auth.currentUser.uid);

    window.location.href = '../app/index.html';
  } catch (err) {
    setError('Failed to save invoice. Please try again.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Invoice';
  }
});

if (featureLockClose) {
  featureLockClose.addEventListener("click", closeLockModal);
}

if (featureLockModal) {
  featureLockModal.addEventListener("click", (event) => {
    if (event.target === featureLockModal) closeLockModal();
  });
}
