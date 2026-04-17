import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, getDocsFromServer, addDoc, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { businessDocPath, businessStateDocPath, invoiceDocPath, invoicesColPath, ledgerColPath, paymentsColPath, userDocPath } from "./firestore-paths.js";
import { checkAccess, getPlanFeatures, syncBusinessPlanStatus, TRIAL_EXPIRED_MESSAGE } from "./subscription.js";

const form = document.getElementById('payment-form');
const invoiceSelect = document.getElementById('pay-invoice');
const invoiceTotalEl = document.getElementById('invoice-total');
const invoicePaidEl = document.getElementById('invoice-paid');
const payAmount = document.getElementById('pay-amount');
const payMode = document.getElementById('pay-mode');
const payDate = document.getElementById('pay-date');
const recordBtn = document.getElementById('record-payment');
const successMsg = document.getElementById('success-msg');
const errorMsg = document.getElementById('error-msg');

let businessId = null;
let businessOwnerUid = null;
let invoiceMap = new Map();
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

async function loadBusiness(businessIdValue) {
  const ownerUid = String(businessOwnerUid || auth.currentUser?.uid || '').trim();
  if (!ownerUid) return null;
  const expectedBusinessId = String(businessIdValue || '').trim();
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
  if (!errorMsg) return;
  errorMsg.textContent = msg || '';
  errorMsg.style.display = msg ? 'block' : 'none';
}

function setSuccess(msg) {
  if (!successMsg) return;
  successMsg.textContent = msg || '';
  successMsg.style.display = msg ? 'block' : 'none';
}

function disablePaymentButton(message = 'Your plan does not include invoice workflows.') {
  if (recordBtn) recordBtn.disabled = true;
  setError(message);
}

async function syncPaymentToCloudState(payment) {
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

  const existingPayment = nextState.payments.some((p) => p.id === payment.id);
  if (!existingPayment) {
    nextState.payments.push(payment);
  }

  const invoice = nextState.invoices.find((inv) => inv.firestoreId === payment.invoiceFirestoreId || inv.id === payment.invoiceFirestoreId);
  if (invoice) {
    invoice.paidAmount = Number(invoice.paidAmount || 0) + Number(payment.amount || 0);
    if ((invoice.paidAmount || 0) >= (invoice.total || 0)) invoice.status = 'paid';
    else if ((invoice.paidAmount || 0) > 0) invoice.status = 'partial';
  }

  if (payment.customerName) {
    nextState.customers[payment.customerName] = {
      ...(nextState.customers[payment.customerName] || {}),
      name: payment.customerName
    };
  }

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

function updateInvoiceSummary() {
  const invId = invoiceSelect.value;
  const inv = invoiceMap.get(invId);
  if (!inv) {
    invoiceTotalEl.textContent = '₹0';
    invoicePaidEl.textContent = '₹0';
    return;
  }
  const paid = Number(inv.amount_paid || 0);
  invoiceTotalEl.textContent = `₹${Number(inv.total_amount || 0).toFixed(2)}`;
  invoicePaidEl.textContent = `₹${paid.toFixed(2)}`;
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
  await syncBusinessPlanStatus(user.uid);
  const userSnap = await getDoc(doc(db, ...userDocPath(user.uid)));
  if (!userSnap.exists()) {
    window.location.href = 'business-setup.html';
    return;
  }
  const userData = userSnap.data();
  if (!userData.business_id) {
    window.location.href = 'business-setup.html';
    return;
  }
  businessId = String(userData.business_id || '').trim();
  businessOwnerUid = String(userData.business_owner_uid || user.uid).trim();
  const loadedBusiness = await loadBusiness(businessId);
  const businessData = loadedBusiness?.businessData || null;
  businessId = String(loadedBusiness?.businessId || businessId || '').trim();
  if (!window.APP_ACCESS) {
    applySoftLockGuards();
    setError(TRIAL_EXPIRED_MESSAGE);
    if (recordBtn) recordBtn.disabled = true;
  }
  if (!window.APP_FEATURES?.invoices) {
    disablePaymentButton();
    return;
  }

  const invSnap = await getDocs(collection(db, ...invoicesColPath(businessOwnerUid, businessId)));
  invoiceSelect.innerHTML = '<option value="">Select unpaid invoice</option>';
  invoiceMap.clear();
  invSnap.forEach(docSnap => {
    const inv = docSnap.data();
    inv.id = docSnap.id;
    if (!['unpaid', 'partial'].includes(String(inv.status || '').toLowerCase())) return;
    invoiceMap.set(inv.id, inv);
    const customer = inv.customer_name || 'Customer';
    const total = Number(inv.total_amount || 0).toFixed(2);
    const opt = document.createElement('option');
    opt.value = inv.id;
    opt.textContent = `${inv.id} • ${customer} • ₹${total}`;
    invoiceSelect.appendChild(opt);
  });

  payDate.value = new Date().toISOString().slice(0, 10);
});

invoiceSelect.addEventListener('change', updateInvoiceSummary);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('');
  setSuccess('');
  if (!businessId) return;
  const loadedBusiness = await loadBusiness(businessId);
  const businessData = loadedBusiness?.businessData || null;
  businessId = String(loadedBusiness?.businessId || businessId || '').trim();
  window.APP_ACCESS = checkAccess(businessData);
  if (!window.APP_ACCESS) {
    showExpiredBanner();
    applySoftLockGuards();
    setError(TRIAL_EXPIRED_MESSAGE);
    return;
  }
  if (!window.APP_FEATURES?.invoices) {
    disablePaymentButton();
    return;
  }
  const invId = invoiceSelect.value;
  const inv = invoiceMap.get(invId);
  if (!inv) {
    setError('Please select an invoice.');
    return;
  }
  const amount = Number(payAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    setError('Payment amount must be greater than 0.');
    return;
  }
  const total = Number(inv.total_amount || 0);
  const paid = Number(inv.amount_paid || 0);
  const remaining = Math.max(0, total - paid);
  if (amount > remaining) {
    setError('Payment exceeds remaining balance.');
    return;
  }

  try {
    recordBtn.disabled = true;
    recordBtn.textContent = 'Saving...';

    const paymentRef = await addDoc(collection(db, ...paymentsColPath(businessOwnerUid, businessId)), {
      business_id: businessId,
      invoice_id: invId,
      amount,
      mode: payMode.value,
      created_at: serverTimestamp()
    });

    const newPaid = paid + amount;
    const newStatus = newPaid >= total ? 'paid' : 'partial';
    await updateDoc(doc(db, ...invoiceDocPath(businessOwnerUid, businessId, invId)), {
      amount_paid: newPaid,
      status: newStatus
    });

    await addDoc(collection(db, ...ledgerColPath(businessOwnerUid, businessId)), {
      business_id: businessId,
      type: 'payment',
      reference_id: paymentRef.id,
      amount: amount,
      balance: 0,
      date: serverTimestamp()
    });

    await syncPaymentToCloudState({
      id: paymentRef.id,
      invoiceId: inv.id || invId,
      invoiceFirestoreId: invId,
      customerName: inv.customer || inv.customer_name || 'Customer',
      amount: amount,
      mode: payMode.value,
      date: payDate.value || new Date().toISOString().slice(0, 10),
      note: ''
    });

    setSuccess('Payment recorded.');
    window.location.href = '../app/index.html';
  } catch (err) {
    setError('Failed to record payment. Try again.');
  } finally {
    recordBtn.disabled = false;
    recordBtn.textContent = 'Record Payment';
  }
});
