import { db, FieldValue } from '../config/firebase.js';
import { HttpError } from '../utils/httpError.js';
import {
  businessDocRef,
  businessIdentityDocRef,
  businessMemberDocRef,
  canonicalBusinessDocRef,
  canonicalBusinessesColRef,
  userDocRef
} from '../utils/firestorePaths.js';

function sanitizeBusiness(doc) {
  if (!doc?.exists) return null;
  return { id: doc.id, ...doc.data() };
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeGstin(value) {
  return String(value || '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

function identityHash(input) {
  let hash = 0;
  const text = String(input || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildIdentityId(payload, ownerUid) {
  const gstin = normalizeGstin(payload?.gstin);
  if (gstin) return `gstin_${gstin}`;
  const name = normalizeToken(payload?.name || payload?.legalName || payload?.businessName);
  const phone = normalizeToken(payload?.phone);
  return `owner_${ownerUid}_${identityHash(`${name}|${phone}`)}`;
}

function buildBusinessData(payload, actorUserId, businessId) {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(now.getDate() + 3);
  return {
    ...payload,
    name: payload.name || payload.businessName || '',
    legalName: payload.legalName || payload.businessName || payload.name || '',
    businessId,
    business_id: businessId,
    ownerUid: actorUserId,
    owner_uid: actorUserId,
    schemaVersion: 2,
    trial_starts_at: payload.trial_starts_at || now.toISOString(),
    trial_ends_at: payload.trial_ends_at || trialEnd.toISOString(),
    plan_type: payload.plan_type || 'trial',
    plan_status: payload.plan_status || 'active',
    subscription_status: payload.subscription_status || 'active',
    is_active: payload.is_active !== false,
    setup_completed: payload.setup_completed !== false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  };
}

function buildOwnerMembership(actorUserId, payload = {}) {
  return {
    uid: actorUserId,
    email: payload.ownerEmail || payload.email || '',
    role: 'owner',
    permissions: {
      manageInvoices: true,
      managePayments: true,
      managePurchases: true,
      manageExpenses: true,
      manageCustomers: true,
      manageInventory: true,
      viewReports: true,
      exportData: true,
      manageSettings: true,
      manageUsers: true
    },
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

export async function createBusiness(payload, actorUserId) {
  const ownerUid = String(actorUserId || '').trim();
  if (!ownerUid) throw new HttpError(401, 'Missing business owner.');

  const identityId = buildIdentityId(payload, ownerUid);
  const identityRef = businessIdentityDocRef(db, identityId);
  const userRef = userDocRef(db, ownerUid);
  const businessRef = canonicalBusinessesColRef(db).doc();
  const memberRef = businessMemberDocRef(db, businessRef.id, ownerUid);
  const legacyBusinessRef = businessDocRef(db, ownerUid, businessRef.id);

  const result = await db.runTransaction(async (tx) => {
    const identitySnap = await tx.get(identityRef);
    if (identitySnap.exists) {
      const existingBusinessId = String(identitySnap.data()?.businessId || '').trim();
      if (existingBusinessId) {
        const existingRef = canonicalBusinessDocRef(db, existingBusinessId);
        const existingSnap = await tx.get(existingRef);
        if (existingSnap.exists) {
          tx.set(userRef, {
            user_id: ownerUid,
            activeBusinessId: existingBusinessId,
            business_id: existingBusinessId,
            business_owner_uid: ownerUid,
            businessIds: FieldValue.arrayUnion(existingBusinessId),
            updatedAt: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp()
          }, { merge: true });
          return { id: existingBusinessId, ...existingSnap.data(), duplicate: true };
        }
      }
      throw new HttpError(409, 'Business identity already exists but could not be resolved.');
    }

    const businessData = buildBusinessData(payload, ownerUid, businessRef.id);
    const membership = buildOwnerMembership(ownerUid, payload);

    tx.set(businessRef, businessData);
    tx.set(memberRef, membership);
    tx.set(identityRef, {
      identityId,
      businessId: businessRef.id,
      ownerUid,
      gstinNormalized: normalizeGstin(payload?.gstin),
      createdAt: FieldValue.serverTimestamp()
    });
    tx.set(userRef, {
      user_id: ownerUid,
      uid: ownerUid,
      email: payload.ownerEmail || payload.email || '',
      activeBusinessId: businessRef.id,
      business_id: businessRef.id,
      business_owner_uid: ownerUid,
      businessIds: FieldValue.arrayUnion(businessRef.id),
      updatedAt: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });

    // Temporary compatibility mirror for screens not yet moved to canonical V2 reads.
    tx.set(legacyBusinessRef, businessData, { merge: true });

    return { id: businessRef.id, ...businessData, duplicate: false };
  });

  return result;
}

export async function getBusinessById(_userId, id) {
  const snap = await canonicalBusinessDocRef(db, id).get();
  const business = sanitizeBusiness(snap);
  if (!business) throw new HttpError(404, 'Business not found.');
  return business;
}

export async function updateBusinessById(userId, id, updates) {
  const ref = canonicalBusinessDocRef(db, id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpError(404, 'Business not found.');
  }

  await ref.update({
    ...updates,
    businessId: id,
    business_id: id,
    updatedAt: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  });
  if (userId) {
    await businessDocRef(db, userId, id).set({
      ...updates,
      businessId: id,
      business_id: id,
      updatedAt: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  const updatedSnap = await ref.get();
  return sanitizeBusiness(updatedSnap);
}

export async function resolveBusinessForUser(userId, preferredBusinessId = '') {
  const uid = String(userId || '').trim();
  if (!uid) throw new HttpError(401, 'Missing user id.');

  const userSnap = await userDocRef(db, uid).get();
  const userData = userSnap.exists ? (userSnap.data() || {}) : {};
  const candidates = [
    preferredBusinessId,
    userData.activeBusinessId,
    userData.business_id,
    ...(Array.isArray(userData.businessIds) ? userData.businessIds : [])
  ].map((value) => String(value || '').trim()).filter(Boolean);

  for (const businessId of candidates) {
    const memberSnap = await businessMemberDocRef(db, businessId, uid).get();
    if (!memberSnap.exists) continue;
    const businessSnap = await canonicalBusinessDocRef(db, businessId).get();
    if (!businessSnap.exists) continue;
    return {
      businessId,
      business: { id: businessId, ...businessSnap.data() },
      member: { id: uid, ...memberSnap.data() }
    };
  }

  throw new HttpError(404, 'No V2 business membership found for user.');
}
