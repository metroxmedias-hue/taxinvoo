import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

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
let invoiceMap = new Map();

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

async function syncPaymentToCloudState(payment) {
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

  const invQuery = query(collection(db, 'invoices'), where('business_id', '==', businessId), where('status', 'in', ['unpaid', 'partial']));
  const invSnap = await getDocs(invQuery);
  invoiceSelect.innerHTML = '<option value="">Select unpaid invoice</option>';
  invoiceMap.clear();
  invSnap.forEach(docSnap => {
    const inv = docSnap.data();
    inv.id = docSnap.id;
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

    const paymentRef = await addDoc(collection(db, 'payments'), {
      business_id: businessId,
      owner_uid: auth.currentUser.uid,
      invoice_id: invId,
      amount,
      mode: payMode.value,
      created_at: serverTimestamp()
    });

    const newPaid = paid + amount;
    const newStatus = newPaid >= total ? 'paid' : 'partial';
    await updateDoc(doc(db, 'invoices', invId), {
      amount_paid: newPaid,
      status: newStatus
    });

    await addDoc(collection(db, 'ledger'), {
      business_id: businessId,
      owner_uid: auth.currentUser.uid,
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
    window.location.href = 'index.html';
  } catch (err) {
    setError('Failed to record payment. Try again.');
  } finally {
    recordBtn.disabled = false;
    recordBtn.textContent = 'Record Payment';
  }
});
