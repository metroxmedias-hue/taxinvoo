import { db, FieldValue } from '../config/firebase.js';
import { HttpError } from '../utils/httpError.js';
import {
  canonicalCustomerDocRef,
  customerDocRef,
  customersColRef
} from '../utils/firestorePaths.js';

function sanitizeCustomer(doc) {
  if (!doc?.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function createCustomer(payload, userId, businessId) {
  const ref = customersColRef(db, userId, businessId).doc();
  const canonicalRef = canonicalCustomerDocRef(db, businessId, ref.id);
  const customerData = {
    ...payload,
    businessId,
    customerId: ref.id,
    canonicalId: ref.id,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await ref.set(customerData);
  await canonicalRef.set({
    ...customerData,
    businessId,
    business_id: businessId,
    customerId: ref.id,
    canonicalId: ref.id,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return { id: ref.id, ...customerData };
}

export async function getCustomerById(id, userId, businessId) {
  const canonicalSnap = await canonicalCustomerDocRef(db, businessId, id).get();
  const fallbackSnap = canonicalSnap.exists ? canonicalSnap : await customerDocRef(db, userId, businessId, id).get();
  const customer = sanitizeCustomer(fallbackSnap);
  if (!customer) throw new HttpError(404, 'Customer not found.');
  return customer;
}

export async function updateCustomerById(id, userId, businessId, updates) {
  const ref = customerDocRef(db, userId, businessId, id);
  const canonicalRef = canonicalCustomerDocRef(db, businessId, id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpError(404, 'Customer not found.');
  }

  const nextUpdates = {
    ...updates,
    businessId,
    business_id: businessId,
    customerId: id,
    canonicalId: id,
    updatedAt: FieldValue.serverTimestamp()
  };
  await ref.update(nextUpdates);
  await canonicalRef.set(nextUpdates, { merge: true });
  const updated = await canonicalRef.get();
  return sanitizeCustomer(updated);
}
