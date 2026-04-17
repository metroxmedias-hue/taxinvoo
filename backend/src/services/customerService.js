import { db, FieldValue } from '../config/firebase.js';
import { HttpError } from '../utils/httpError.js';
import { customerDocRef, customersColRef } from '../utils/firestorePaths.js';

function sanitizeCustomer(doc) {
  if (!doc?.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function createCustomer(payload, userId, businessId) {
  const ref = customersColRef(db, userId, businessId).doc();
  const customerData = {
    ...payload,
    businessId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await ref.set(customerData);
  return { id: ref.id, ...customerData };
}

export async function getCustomerById(id, userId, businessId) {
  const snap = await customerDocRef(db, userId, businessId, id).get();
  const customer = sanitizeCustomer(snap);
  if (!customer) throw new HttpError(404, 'Customer not found.');
  return customer;
}

export async function updateCustomerById(id, userId, businessId, updates) {
  const ref = customerDocRef(db, userId, businessId, id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpError(404, 'Customer not found.');
  }

  await ref.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
  const updated = await ref.get();
  return sanitizeCustomer(updated);
}
