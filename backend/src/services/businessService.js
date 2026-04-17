import { db, FieldValue } from '../config/firebase.js';
import { HttpError } from '../utils/httpError.js';
import { businessDocRef, businessesColRef } from '../utils/firestorePaths.js';

function sanitizeBusiness(doc) {
  if (!doc?.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function createBusiness(payload, actorUserId) {
  const businessRef = businessesColRef(db, actorUserId).doc();
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(now.getDate() + 3);
  const businessData = {
    ...payload,
    ownerUid: actorUserId,
    businessId: businessRef.id,
    trial_starts_at: now.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
    plan_type: 'trial',
    plan_status: 'active',
    is_active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  await businessRef.set(businessData);
  return { id: businessRef.id, ...businessData };
}

export async function getBusinessById(userId, id) {
  const snap = await businessDocRef(db, userId, id).get();
  const business = sanitizeBusiness(snap);
  if (!business) throw new HttpError(404, 'Business not found.');
  return business;
}

export async function updateBusinessById(userId, id, updates) {
  const ref = businessDocRef(db, userId, id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpError(404, 'Business not found.');
  }

  await ref.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
  const updatedSnap = await ref.get();
  return sanitizeBusiness(updatedSnap);
}
