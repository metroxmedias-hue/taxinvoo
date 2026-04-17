import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { collection, getDocs, getDocsFromServer } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { invoicesColPath } from "./firestore-paths.js";
import {
  checkAccess,
  canAccessFeature,
  getPlanFeatures,
  getUserAccessContext,
  isBusinessSetupComplete,
  syncBusinessPlanStatus,
  syncSubscriptionStatus,
  trialDaysLeft
} from "./subscription.js";

const trialBanner = document.getElementById('trial-banner');
const trialEnded = document.getElementById('trial-ended');
const trialDays = document.getElementById('trial-days');
const businessName = document.getElementById('business-name');
const emptyState = document.getElementById('empty-state');
const createFirstInvoice = document.getElementById('create-first-invoice');
window.APP_FEATURES = window.APP_FEATURES || getPlanFeatures('trial');

function show(el, visible) {
  if (!el) return;
  el.style.display = visible ? 'flex' : 'none';
}

async function loadBusiness(userData) {
  const ownerUid = String(userData?.business_owner_uid || userData?.user_id || auth.currentUser?.uid || "").trim();
  if (!ownerUid) return null;
  const expectedBusinessId = String(userData?.business_id || "").trim();
  const colRef = collection(db, "users", ownerUid, "businesses");
  let snap = null;
  try {
    snap = await getDocsFromServer(colRef);
  } catch (_) {
    snap = await getDocs(colRef);
  }
  if (!snap || snap.empty) return null;
  const businessDoc = snap.docs.find((row) => row.id === expectedBusinessId) || snap.docs[0];
  const businessData = { ...(businessDoc.data() || {}), business_id: businessDoc.id };
  const features = getPlanFeatures(businessData.plan_type);
  window.businessData = businessData;
  window.APP_FEATURES = features;
  const hasAccess = checkAccess(businessData);
  window.APP_ACCESS = hasAccess;
  console.log("🔥 CORRECT BUSINESS:", businessData);
  if (!hasAccess) showExpiredBanner();
  return { businessId: businessDoc.id, businessData };
}

window.APP_ACCESS = typeof window.APP_ACCESS === "boolean" ? window.APP_ACCESS : true;

function installGlobalAccessGuards() {
  if (window.__appAccessGuardsInstalled) return;
  window.__appAccessGuardsInstalled = true;

  document.addEventListener("click", (e) => {
    if (window.APP_ACCESS) return;
    const target = e?.target?.closest?.("button, a");
    if (!target) return;
    if (isAllowedWhenLocked(target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    alert("Trial expired. Please upgrade.");
  }, true);

  document.addEventListener("submit", (e) => {
    if (window.APP_ACCESS) return;
    if (!e?.target?.closest?.("form")) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    alert("Trial expired. Cannot submit.");
  }, true);
}

function isAllowedWhenLocked(target) {
  const el = target?.closest?.("button, a");
  if (!el) return false;
  if (el.closest('[data-allow-when-locked="true"]')) return true;
  if (el.hasAttribute("data-billing-cycle") || el.hasAttribute("data-plan-action")) return true;
  const id = String(el.id || "").toLowerCase();
  if ([
    "settings-back-dashboard",
    "upgrade-cta",
    "settings-buy-plan-btn",
    "settings-banner-upgrade-cta",
    "settings-upgrade-btn",
  ].includes(id)) return true;
  const href = String(el.getAttribute("href") || "").toLowerCase();
  if (href.includes("pricing") || href.includes("index.html") || href.includes("#/dashboard")) return true;
  const onclick = String(el.getAttribute("onclick") || "").toLowerCase();
  if (onclick.includes("pricing") || onclick.includes("index.html")) return true;
  const text = String(el.textContent || "").toLowerCase();
  return text.includes("upgrade") || text.includes("pricing") || text.includes("back to dashboard") || text.includes("start free trial") || text.includes("monthly") || text.includes("yearly");
}

function showExpiredBanner() {
  if (document.getElementById("trial-soft-lock-banner")) return;
  const banner = document.createElement("div");
  banner.id = "trial-soft-lock-banner";
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

function blockIfNoAccess(e) {
  if (window.APP_ACCESS) return true;
  if (isAllowedWhenLocked(e?.target)) return true;
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
  alert("Your trial has expired. Please upgrade to continue.");
  return false;
}

function applySoftLockGuards() {
  document.querySelectorAll("button, a[data-action='create'], a[data-action='edit']").forEach((el) => {
    if (el.dataset.softLockBound === "1") return;
    el.dataset.softLockBound = "1";
    el.addEventListener("click", blockIfNoAccess, true);
  });
  document.querySelectorAll("form").forEach((formEl) => {
    if (formEl.dataset.softLockSubmitBound === "1") return;
    formEl.dataset.softLockSubmitBound = "1";
    formEl.addEventListener("submit", (e) => {
      if (window.APP_ACCESS) return;
      e.preventDefault();
      alert("Trial expired. Cannot submit.");
    });
  });
  if (!window.APP_ACCESS) {
    document.querySelectorAll("button").forEach((btn) => {
      if (isAllowedWhenLocked(btn)) return;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    });
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      el.disabled = true;
    });
  }
}

installGlobalAccessGuards();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log('No auth → redirect to login');
    window.location.href = '../pages/login.html';
    return;
  }
  if (!user.emailVerified) {
    window.location.href = '../pages/verify-email.html';
    return;
  }
  console.log('AUTH OK:', user.uid);
  await syncSubscriptionStatus(user.uid);
  await syncBusinessPlanStatus(user.uid);
  const context = await getUserAccessContext(user.uid);
  const userData = context?.user;
  const loadedBusiness = await loadBusiness(userData);
  const bizData = loadedBusiness?.businessData || null;
  if (!userData?.business_id || !isBusinessSetupComplete(bizData)) {
    window.location.href = '../pages/business-setup.html';
    return;
  }
  applySoftLockGuards();
  if (createFirstInvoice && !window.APP_FEATURES?.invoices) {
    createFirstInvoice.disabled = true;
    createFirstInvoice.title = "Upgrade plan to create invoices.";
  }

  if (businessName) businessName.textContent = bizData.name || 'Your Business';
  const businessId = String(loadedBusiness?.businessId || userData?.business_id || '').trim();
  const businessOwnerUid = String(userData?.business_owner_uid || user.uid).trim();
  const plan = String(context?.subscription?.plan || 'trial').toLowerCase();
  const status = String(context?.subscription?.status || 'active').toLowerCase();
  const daysLeft = trialDaysLeft(context?.subscription || {});

  if (plan === 'trial' && (status === 'active' || status === 'grace')) {
    if (trialDays) trialDays.textContent = String(daysLeft || 0);
    show(trialBanner, true);
    show(trialEnded, false);
  } else if (status === 'expired') {
    show(trialBanner, false);
    show(trialEnded, true);
    if (createFirstInvoice) createFirstInvoice.disabled = !canAccessFeature(context, 'add_records');
  } else {
    show(trialBanner, false);
    show(trialEnded, false);
  }

  const invSnap = await getDocs(collection(db, ...invoicesColPath(businessOwnerUid, businessId)));

  if (invSnap.empty) {
    show(emptyState, true);
    if (emptyState) emptyState.classList.add('fullscreen');
    document.body.classList.add('welcome-full');
  }
  applySoftLockGuards();
});

if (createFirstInvoice) {
  createFirstInvoice.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}
