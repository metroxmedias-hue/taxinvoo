import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { db } from "./firebase.js";
import {
  businessDocPath,
  businessIdentityDocPath,
  businessMemberDocPath,
  canonicalBusinessDocPath,
  canonicalBusinessesColPath,
  userDocPath
} from "./firestore-paths.js";

const OWNER_PERMISSIONS = {
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
};

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeGstin(value) {
  return String(value || "").trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function identityHash(input) {
  let hash = 0;
  const text = String(input || "");
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

function buildBusinessPayload(payload, user, businessId) {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(now.getDate() + 3);
  return {
    ...payload,
    name: payload.name || payload.businessName || "",
    legalName: payload.legalName || payload.businessName || payload.name || "",
    businessId,
    business_id: businessId,
    ownerUid: user.uid,
    owner_uid: user.uid,
    schemaVersion: 2,
    setup_completed: true,
    invoice_count: Number(payload.invoice_count || 0),
    plan_type: payload.plan_type || "trial",
    plan_status: payload.plan_status || "active",
    current_plan: payload.current_plan || payload.plan_type || "trial",
    subscription_status: payload.subscription_status || "active",
    trial_starts_at: payload.trial_starts_at || now.toISOString(),
    trial_ends_at: payload.trial_ends_at || trialEnd.toISOString(),
    is_active: payload.is_active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  };
}

function buildOwnerMembership(user) {
  return {
    uid: user.uid,
    email: user.email || "",
    role: "owner",
    permissions: OWNER_PERMISSIONS,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

export async function createOrResolveBusinessV2(user, payload = {}) {
  if (!user?.uid) throw new Error("User is required to create a business.");

  const identityId = buildIdentityId(payload, user.uid);
  const identityRef = doc(db, ...businessIdentityDocPath(identityId));
  const userRef = doc(db, ...userDocPath(user.uid));
  const businessRef = doc(collection(db, ...canonicalBusinessesColPath()));
  const memberRef = doc(db, ...businessMemberDocPath(businessRef.id, user.uid));
  const legacyBusinessRef = doc(db, ...businessDocPath(user.uid, businessRef.id));

  return runTransaction(db, async (tx) => {
    const identitySnap = await tx.get(identityRef);
    if (identitySnap.exists()) {
      const existingBusinessId = String(identitySnap.data()?.businessId || "").trim();
      if (!existingBusinessId) throw new Error("Business identity exists without a business reference.");
      const existingRef = doc(db, ...canonicalBusinessDocPath(existingBusinessId));
      const existingSnap = await tx.get(existingRef);
      if (!existingSnap.exists()) throw new Error("Existing business identity could not be resolved.");
      tx.set(userRef, {
        user_id: user.uid,
        uid: user.uid,
        email: user.email || "",
        activeBusinessId: existingBusinessId,
        business_id: existingBusinessId,
        business_owner_uid: user.uid,
        businessIds: arrayUnion(existingBusinessId),
        updatedAt: serverTimestamp(),
        updated_at: serverTimestamp()
      }, { merge: true });
      return { id: existingBusinessId, businessId: existingBusinessId, duplicate: true, ...(existingSnap.data() || {}) };
    }

    const businessPayload = buildBusinessPayload(payload, user, businessRef.id);
    tx.set(businessRef, businessPayload);
    tx.set(memberRef, buildOwnerMembership(user));
    tx.set(identityRef, {
      identityId,
      businessId: businessRef.id,
      ownerUid: user.uid,
      gstinNormalized: normalizeGstin(payload?.gstin),
      createdAt: serverTimestamp()
    });
    tx.set(userRef, {
      user_id: user.uid,
      uid: user.uid,
      email: user.email || "",
      activeBusinessId: businessRef.id,
      business_id: businessRef.id,
      business_owner_uid: user.uid,
      businessIds: arrayUnion(businessRef.id),
      updatedAt: serverTimestamp(),
      updated_at: serverTimestamp()
    }, { merge: true });

    // Temporary compatibility mirror for screens still reading the legacy business path.
    tx.set(legacyBusinessRef, businessPayload, { merge: true });

    return { id: businessRef.id, businessId: businessRef.id, duplicate: false, ...businessPayload };
  });
}

export async function resolveActiveBusinessV2(user, preferredBusinessId = "") {
  if (!user?.uid) return null;
  const userSnap = await getDoc(doc(db, ...userDocPath(user.uid)));
  const userData = userSnap.exists() ? (userSnap.data() || {}) : {};
  const candidates = [
    preferredBusinessId,
    userData.activeBusinessId,
    userData.business_id,
    ...(Array.isArray(userData.businessIds) ? userData.businessIds : [])
  ].map((value) => String(value || "").trim()).filter(Boolean);

  for (const businessId of candidates) {
    const memberSnap = await getDoc(doc(db, ...businessMemberDocPath(businessId, user.uid)));
    if (!memberSnap.exists()) continue;
    const businessSnap = await getDoc(doc(db, ...canonicalBusinessDocPath(businessId)));
    if (!businessSnap.exists()) continue;
    return {
      businessId,
      business: { id: businessId, ...(businessSnap.data() || {}) },
      member: { id: user.uid, ...(memberSnap.data() || {}) }
    };
  }

  return null;
}

export async function mirrorBusinessToLegacyOwnerPath(user, businessId, payload = {}) {
  if (!user?.uid || !businessId) return;
  await setDoc(doc(db, ...businessDocPath(user.uid, businessId)), {
    ...payload,
    businessId,
    business_id: businessId,
    updatedAt: serverTimestamp(),
    updated_at: serverTimestamp()
  }, { merge: true });
}
