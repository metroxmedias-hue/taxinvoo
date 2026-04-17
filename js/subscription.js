import { db } from "./firebase.js";
import {
  Timestamp,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import {
  businessDocPath,
  subscriptionDocPath,
  usageDocPath,
  userDocPath
} from "./firestore-paths.js";

export const SUBSCRIPTION_PLANS = {
  trial: "trial",
  starter: "starter",
  growth: "growth",
  pro: "pro"
};

export const SUBSCRIPTION_STATUS = {
  active: "active",
  expired: "expired",
  grace: "grace"
};

export const PLAN_CONFIG = {
  trial: {
    all_access: true
  },
  starter: {
    invoices_limit: 50,
    ai_features: false,
    advanced_reports: false,
    team_access: false,
    audit_logs: false
  },
  growth: {
    invoices_limit: "unlimited",
    ai_features: true,
    advanced_reports: false,
    team_access: false,
    audit_logs: false
  },
  pro: {
    invoices_limit: "unlimited",
    ai_features: true,
    advanced_reports: true,
    team_access: true,
    audit_logs: true
  }
};

const TRIAL_DAYS = 3;
const GRACE_DAYS = 1;
export const TRIAL_EXPIRED_MESSAGE = "Your trial has expired. Please upgrade your plan to continue.";

function nowDate() {
  return new Date();
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value?.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();
  if (value === "basic") return SUBSCRIPTION_PLANS.starter;
  if (value === SUBSCRIPTION_PLANS.starter) return SUBSCRIPTION_PLANS.starter;
  if (value === SUBSCRIPTION_PLANS.growth) return SUBSCRIPTION_PLANS.growth;
  if (value === SUBSCRIPTION_PLANS.pro) return SUBSCRIPTION_PLANS.pro;
  return SUBSCRIPTION_PLANS.trial;
}

export function getPlanFeatures(plan) {
  const normalizedPlan = normalizePlan(plan);
  const plans = {
    trial: {
      invoices: true,
      quotations: true,
      reports: true,
      multi_user: true
    },
    basic: {
      invoices: true,
      quotations: true,
      reports: false,
      multi_user: false
    },
    starter: {
      invoices: true,
      quotations: true,
      reports: false,
      multi_user: false
    },
    growth: {
      invoices: true,
      quotations: true,
      reports: true,
      multi_user: false
    },
    pro: {
      invoices: true,
      quotations: true,
      reports: true,
      multi_user: true
    }
  };

  return plans[normalizedPlan] || plans.trial;
}

function normalizeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === SUBSCRIPTION_STATUS.expired) return SUBSCRIPTION_STATUS.expired;
  if (value === SUBSCRIPTION_STATUS.grace) return SUBSCRIPTION_STATUS.grace;
  return SUBSCRIPTION_STATUS.active;
}

function isPermissionError(error) {
  const code = String(error?.code || "").toLowerCase();
  return code.includes("permission-denied") || code.includes("unauthenticated");
}

function resolveBusinessOwnerUid(userData, fallbackUserId = "") {
  const owner = String(userData?.business_owner_uid || "").trim();
  if (owner) return owner;
  return String(fallbackUserId || "").trim();
}

function normalizeBusinessPlanType(business) {
  return String(business?.plan_type || business?.current_plan || SUBSCRIPTION_PLANS.trial).trim().toLowerCase();
}

function normalizeBusinessPlanStatus(business) {
  return String(business?.plan_status || business?.subscription_status || SUBSCRIPTION_STATUS.active).trim().toLowerCase();
}

function resolveBusinessTrialEnd(business) {
  return toDate(business?.trial_ends_at || null);
}

export function checkAccess(business) {
  if (!business) return false;
  const end = business.trial_ends_at;
  if (!end) return false;
  const trialEnd = new Date(end).getTime();
  const now = Date.now();
  if (!Number.isFinite(trialEnd)) return false;
  return now <= trialEnd && business.is_active !== false;
}

export function isBusinessAccessActive(business) {
  if (!business || typeof business !== "object") return true;
  const planType = normalizeBusinessPlanType(business);
  const status = normalizeBusinessPlanStatus(business);
  const isActive = business?.is_active;
  const timeAccess = checkAccess(business);

  if (typeof isActive === "boolean") {
    return isActive && timeAccess;
  }
  if (planType !== SUBSCRIPTION_PLANS.trial) {
    return true;
  }
  if (status === SUBSCRIPTION_STATUS.expired) {
    return false;
  }
  if (!timeAccess) {
    return false;
  }
  return true;
}

export function evaluateSubscriptionStatus(subscription, refDate = nowDate()) {
  const plan = normalizePlan(subscription?.plan);
  const isPaid = Boolean(subscription?.is_paid);
  const currentStatus = normalizeStatus(subscription?.status);

  if (isPaid && plan !== SUBSCRIPTION_PLANS.trial) {
    const periodEnd = toDate(subscription?.current_period_end);
    if (!periodEnd || refDate <= periodEnd) {
      return SUBSCRIPTION_STATUS.active;
    }
    return SUBSCRIPTION_STATUS.expired;
  }

  const trialEnd = toDate(subscription?.trial_ends_at);
  if (!trialEnd) return currentStatus;
  if (refDate <= trialEnd) return SUBSCRIPTION_STATUS.active;

  const graceEnd = new Date(trialEnd.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
  if (refDate <= graceEnd) return SUBSCRIPTION_STATUS.grace;
  return SUBSCRIPTION_STATUS.expired;
}

export function canAccessFeature(userContext, feature) {
  const sub = userContext?.subscription || {};
  const plan = normalizePlan(sub.plan);
  const status = normalizeStatus(sub.status);

  if (plan === SUBSCRIPTION_PLANS.trial && (status === SUBSCRIPTION_STATUS.active || status === SUBSCRIPTION_STATUS.grace)) {
    return true;
  }

  if (status === SUBSCRIPTION_STATUS.expired) {
    if (feature === "view_data" || feature === "download_pdf") {
      return true;
    }
    return false;
  }

  const config = PLAN_CONFIG[plan] || PLAN_CONFIG.trial;
  if (config.all_access) return true;
  return config[feature] === true;
}

export function canCreateInvoice(userContext) {
  const sub = userContext?.subscription || {};
  const usageCount = Number(userContext?.usage?.invoices_created_count || 0);
  const plan = normalizePlan(sub.plan);
  const status = normalizeStatus(sub.status);

  if (status === SUBSCRIPTION_STATUS.expired) return false;
  if (plan === SUBSCRIPTION_PLANS.trial) return true;
  if (plan === SUBSCRIPTION_PLANS.starter) return usageCount < Number(PLAN_CONFIG.starter.invoices_limit || 50);
  return true;
}

export function trialDaysLeft(subscription, refDate = nowDate()) {
  const trialEnd = toDate(subscription?.trial_ends_at);
  if (!trialEnd) return 0;
  const diff = trialEnd.getTime() - refDate.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export async function ensureUserRecord(user, extra = {}) {
  if (!user?.uid) return;
  const ref = doc(db, ...userDocPath(user.uid));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const base = {
      user_id: user.uid,
      email: user.email || "",
      ...extra
    };
    if (!snap.exists()) {
      tx.set(ref, { ...base, created_at: serverTimestamp(), updated_at: serverTimestamp() }, { merge: true });
      return;
    }
    tx.set(ref, { ...base, updated_at: serverTimestamp() }, { merge: true });
  });
}

export async function ensureTrialSubscription(userId, refDate = nowDate()) {
  if (!userId) return;
  const subRef = doc(db, ...subscriptionDocPath(userId));
  const usageRef = doc(db, ...usageDocPath(userId));

  const trialEnd = new Date(refDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await runTransaction(db, async (tx) => {
    const subSnap = await tx.get(subRef);
    const usageSnap = await tx.get(usageRef);

    if (!subSnap.exists()) {
      tx.set(subRef, {
        user_id: userId,
        plan: SUBSCRIPTION_PLANS.trial,
        status: SUBSCRIPTION_STATUS.active,
        trial_ends_at: trialEnd.toISOString(),
        current_period_end: null,
        is_paid: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
    }
    if (!usageSnap.exists()) {
      tx.set(usageRef, {
        user_id: userId,
        invoices_created_count: 0,
        updated_at: serverTimestamp(),
        created_at: serverTimestamp()
      });
    }
  });
}

export async function ensureBusinessRecord(userId, businessId, payload = {}) {
  if (!userId || !businessId) return;
  const ref = doc(db, ...businessDocPath(userId, businessId));
  await setDoc(
    ref,
    {
      business_id: businessId,
      setup_completed: false,
      updated_at: serverTimestamp(),
      ...payload
    },
    { merge: true }
  );
}

export async function markBusinessSetupCompleted(userId, businessId, payload = {}) {
  if (!userId || !businessId) return;
  const ref = doc(db, ...businessDocPath(userId, businessId));
  await setDoc(
    ref,
    {
      business_id: businessId,
      setup_completed: true,
      updated_at: serverTimestamp(),
      ...payload
    },
    { merge: true }
  );
}

export async function linkUserToBusiness(userId, businessId, businessOwnerUid = userId) {
  if (!userId || !businessId) return;
  const ref = doc(db, ...userDocPath(userId));
  await setDoc(
    ref,
    {
      user_id: userId,
      business_id: businessId,
      business_owner_uid: businessOwnerUid,
      updated_at: serverTimestamp()
    },
    { merge: true }
  );
}

export async function syncBusinessPlanStatus(userId) {
  if (!userId) return null;
  const userSnap = await getDoc(doc(db, ...userDocPath(userId)));
  if (!userSnap.exists()) return null;
  const userData = userSnap.data() || {};
  const businessId = String(userData.business_id || "").trim();
  if (!businessId) return null;

  const businessOwnerUid = resolveBusinessOwnerUid(userData, userId);
  const businessRef = doc(db, ...businessDocPath(businessOwnerUid, businessId));
  const businessSnap = await getDoc(businessRef);
  if (!businessSnap.exists()) return null;

  const business = businessSnap.data() || {};
  const planType = normalizeBusinessPlanType(business);
  const planStatus = normalizeBusinessPlanStatus(business);
  const trialEndRaw = business?.trial_ends_at ?? null;
  const trialEndDate = typeof trialEndRaw?.toDate === "function" ? trialEndRaw.toDate() : toDate(trialEndRaw);
  const now = new Date();
  console.log("NOW:", new Date());
  if (typeof trialEndRaw?.toDate === "function") {
    console.log("TRIAL END:", trialEndRaw.toDate());
  } else {
    console.log("TRIAL END:", trialEndDate);
  }

  const updates = {};
  if (planType === SUBSCRIPTION_PLANS.trial && trialEndDate && now > trialEndDate) {
    updates.plan_status = SUBSCRIPTION_STATUS.expired;
    updates.subscription_status = SUBSCRIPTION_STATUS.expired;
    updates.is_active = false;
  } else if (planType !== SUBSCRIPTION_PLANS.trial) {
    if (business.is_active !== true) updates.is_active = true;
    if (planStatus !== SUBSCRIPTION_STATUS.active) {
      updates.plan_status = SUBSCRIPTION_STATUS.active;
      updates.subscription_status = SUBSCRIPTION_STATUS.active;
    }
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(businessRef, {
      ...updates,
      updated_at: serverTimestamp()
    });
    return { ...business, ...updates };
  }
  return business;
}

export async function getUserAccessContext(userId) {
  if (!userId) return null;

  const userRef = doc(db, ...userDocPath(userId));
  const subRef = doc(db, ...subscriptionDocPath(userId));
  const usageRef = doc(db, ...usageDocPath(userId));

  let userSnap = null;
  let subSnap = null;
  let usageSnap = null;

  try {
    userSnap = await getDoc(userRef);
  } catch (error) {
    if (!isPermissionError(error)) throw error;
  }
  try {
    subSnap = await getDoc(subRef);
  } catch (error) {
    if (!isPermissionError(error)) throw error;
  }
  try {
    usageSnap = await getDoc(usageRef);
  } catch (error) {
    if (!isPermissionError(error)) throw error;
  }

  const user = userSnap?.exists?.() ? userSnap.data() : null;
  const subscription = subSnap?.exists?.()
    ? subSnap.data()
    : {
        user_id: userId,
        plan: SUBSCRIPTION_PLANS.trial,
        status: SUBSCRIPTION_STATUS.active,
        is_paid: false
      };
  const usage = usageSnap?.exists?.() ? usageSnap.data() : { user_id: userId, invoices_created_count: 0 };

  let business = null;
  const businessId = String(user?.business_id || "").trim();
  if (businessId) {
    const ownerUid = resolveBusinessOwnerUid(user, userId);
    try {
      const businessSnap = await getDoc(doc(db, ...businessDocPath(ownerUid, businessId)));
      business = businessSnap.exists() ? businessSnap.data() : null;
    } catch (error) {
      if (!isPermissionError(error)) throw error;
      business = null;
    }
  }
  if (business && typeof business === "object") {
    const planType = normalizeBusinessPlanType(business);
    const planStatus = normalizeBusinessPlanStatus(business);
    business = {
      ...business,
      plan_type: planType,
      plan_status: planStatus,
      trial_ends_at: business.trial_ends_at || null,
      is_active: isBusinessAccessActive({
        ...business,
        plan_type: planType,
        plan_status: planStatus
      })
    };
  }

  const evaluatedStatus = evaluateSubscriptionStatus(subscription);

  return {
    user: user || { user_id: userId, business_id: "", business_owner_uid: userId },
    business,
    subscription: {
      ...subscription,
      plan: normalizePlan(subscription.plan),
      status: evaluatedStatus
    },
    usage: {
      ...usage,
      invoices_created_count: Number(usage?.invoices_created_count || 0)
    }
  };
}

export function isBusinessSetupComplete(business) {
  if (!business || typeof business !== "object") return false;
  if (business.setup_completed === true) return true;
  return Boolean(String(business.name || "").trim());
}

export async function syncSubscriptionStatus(userId) {
  if (!userId) return null;
  const subRef = doc(db, ...subscriptionDocPath(userId));
  let subSnap = null;
  try {
    subSnap = await getDoc(subRef);
  } catch (error) {
    if (isPermissionError(error)) return null;
    throw error;
  }
  if (!subSnap.exists()) return null;

  const data = subSnap.data();
  const nextStatus = evaluateSubscriptionStatus(data);
  if (nextStatus !== data.status) {
    try {
      await setDoc(subRef, { status: nextStatus, updated_at: serverTimestamp() }, { merge: true });
    } catch (error) {
      if (!isPermissionError(error)) throw error;
    }
  }
  return nextStatus;
}

export async function incrementInvoiceUsage(userId) {
  if (!userId) return;
  const usageRef = doc(db, ...usageDocPath(userId));
  await setDoc(
    usageRef,
    {
      user_id: userId,
      invoices_created_count: increment(1),
      updated_at: serverTimestamp()
    },
    { merge: true }
  );
}

export async function upgradeSubscription(userId, selectedPlan, periodDays = 30) {
  if (!userId) throw new Error("User id required.");
  const plan = normalizePlan(selectedPlan);
  if (plan === SUBSCRIPTION_PLANS.trial) throw new Error("Cannot upgrade to trial.");

  const currentPeriodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);
  const subRef = doc(db, ...subscriptionDocPath(userId));
  await setDoc(
    subRef,
    {
      user_id: userId,
      plan,
      status: SUBSCRIPTION_STATUS.active,
      is_paid: true,
      current_period_end: currentPeriodEnd.toISOString(),
      updated_at: serverTimestamp()
    },
    { merge: true }
  );

  const userSnap = await getDoc(doc(db, ...userDocPath(userId)));
  const businessId = userSnap.exists() ? String(userSnap.data()?.business_id || "").trim() : "";
  const businessOwnerUid = userSnap.exists() ? resolveBusinessOwnerUid(userSnap.data(), userId) : userId;
  if (businessId) {
    await setDoc(
      doc(db, ...businessDocPath(businessOwnerUid, businessId)),
      {
        current_plan: plan,
        subscription_status: SUBSCRIPTION_STATUS.active,
        updated_at: serverTimestamp()
      },
      { merge: true }
    );
  }
}

export async function handleUpgradePaymentSuccess({ userId, selectedPlan, periodDays = 30 } = {}) {
  if (!userId) throw new Error("User id required.");
  if (!selectedPlan) throw new Error("Plan required.");
  await upgradeSubscription(userId, selectedPlan, periodDays);
  return { ok: true };
}

export async function findPendingInviteByEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;
  const inviteQ = query(
    collectionGroup(db, "accountant_invites"),
    where("email_lower", "==", normalizedEmail),
    where("status", "==", "pending"),
    limit(1)
  );
  const snap = await getDocs(inviteQ);
  if (snap.empty) return null;
  const row = snap.docs[0];
  const businessRef = row.ref.parent.parent;
  const ownerRef = businessRef?.parent?.parent;
  return {
    id: row.id,
    ref: row.ref,
    data: row.data() || {},
    business_id: businessRef?.id || "",
    business_owner_uid: ownerRef?.id || ""
  };
}
