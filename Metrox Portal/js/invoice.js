import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, addDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

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

  let businessId = null;
  let currentPlan = 'trial';
  let subscriptionStatus = 'trial';

function setError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg || '';
  errorEl.style.display = msg ? 'block' : 'none';
}

async function syncInvoiceToCloudState(invoiceRefId, payload) {
  if (!businessId || !auth.currentUser) return;
  const stateRef = doc(db, 'businesses', businessId, 'app_meta', 'state');
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
    owner_uid: auth.currentUser.uid,
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

function setTrialLimitReached(reached) {
  if (saveBtn) saveBtn.disabled = false;
  if (trialMsg) {
    trialMsg.textContent = '';
    trialMsg.style.display = 'none';
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  const userSnap = await getDoc(doc(db, 'users', user.uid));
  if (!userSnap.exists()) {
    window.location.href = 'business-setup.html';
    return;
  }
  const userData = userSnap.data();
  if (!userData.business_id) {
    window.location.href = 'business-setup.html';
    return;
  }
  businessId = userData.business_id;

  const bizSnap = await getDoc(doc(db, 'businesses', businessId));
  if (bizSnap.exists()) {
    currentPlan = bizSnap.data().current_plan || 'trial';
    subscriptionStatus = bizSnap.data().subscription_status || (currentPlan === 'trial' ? 'trial' : 'active');
  }

  const invQuery = query(collection(db, 'invoices'), where('business_id', '==', businessId));
  const invSnap = await getDocs(invQuery);
  const invoiceCount = invSnap.size;
  if (subscriptionStatus !== 'active' && currentPlan !== 'trial') {
    setTrialLimitReached(false);
  }
  setTrialLimitReached(false);
  calcTotals();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('');
  if (!businessId) return;
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

    const invoiceRef = await addDoc(collection(db, 'invoices'), {
      business_id: businessId,
      owner_uid: auth.currentUser.uid,
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

    await addDoc(collection(db, 'ledger'), {
      business_id: businessId,
      owner_uid: auth.currentUser.uid,
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

    window.location.href = 'index.html';
  } catch (err) {
    setError('Failed to save invoice. Please try again.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Invoice';
  }
});
