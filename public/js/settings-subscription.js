import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { collection, collectionGroup, doc, getDoc, getDocs, getDocsFromServer, query, where } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getUserData, setUserData } from "./userState.js";

console.log("SETTINGS SCRIPT LOADED ✅");
console.log("Auth object:", auth);
console.log("DB object:", db);

let latestBusinessData = null;
let latestBusinessId = "";

function getDaysLeft(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const diff = date - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function resolveEndDate(data) {
  const raw = data?.subscription_end_date ?? data?.trial_ends_at ?? null;
  if (!raw) return null;
  if (typeof raw?.toDate === "function") return raw.toDate();
  if (raw?.seconds) return new Date(raw.seconds * 1000);
  return new Date(raw);
}

function normalizePlan(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "starter" || raw === "basic") return "starter";
  if (raw === "growth") return "growth";
  if (raw === "pro" || raw === "premium") return "pro";
  return "trial";
}

function getAccessRank(data) {
  const planType = normalizePlan(data?.plan_type || data?.current_plan || "trial");
  const status = String(data?.plan_status || data?.subscription_status || "active").trim().toLowerCase();
  if ((planType === "starter" || planType === "growth" || planType === "pro") && status === "active") return 3;
  const trialEnd = resolveEndDate({ trial_ends_at: data?.trial_ends_at || null });
  if (planType === "trial" && trialEnd instanceof Date && !Number.isNaN(trialEnd.getTime()) && trialEnd >= new Date()) return 2;
  return 1;
}

async function resolveBusinessContext(uid) {
  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.exists() ? (userSnap.data() || {}) : {};
  const expectedBusinessId = String(
    localStorage.getItem("activeBusinessId")
    || localStorage.getItem("activeBusinessProfileId")
    || window.currentBusinessId
    || getUserData()?.business_id
    || window.businessData?.business_id
    || userData.business_id
    || ""
  ).trim();

  const membershipQuery = query(collectionGroup(db, "members"), where("uid", "==", uid));
  let memberSnap = null;
  try {
    memberSnap = await getDocsFromServer(membershipQuery);
  } catch (err) {
    console.warn("[multi-business] Account server membership lookup failed; falling back to cache:", err);
    memberSnap = await getDocs(membershipQuery);
  }
  const memberDocs = memberSnap?.docs || [];
  console.log("[multi-business] Account membership records found:", memberDocs.map((row) => ({
    businessId: row.ref?.parent?.parent?.id || "",
    memberId: row.id,
    ...(row.data?.() || {})
  })));
  const membershipRows = [];
  for (const memberDoc of memberDocs) {
    const businessRef = memberDoc.ref?.parent?.parent || null;
    const businessId = String(businessRef?.id || "").trim();
    if (!businessRef || !businessId) continue;
    const businessSnap = await getDoc(businessRef);
    if (!businessSnap.exists()) continue;
    membershipRows.push({
      businessId,
      businessData: { ...(businessSnap.data() || {}), business_id: businessId }
    });
  }
  console.log("[multi-business] Account businesses returned from Firestore:", membershipRows.map((row) => ({
    businessId: row.businessId,
    name: row.businessData?.name || "Business"
  })));
  if (membershipRows.length) {
    const paidActiveRow = membershipRows.find((row) => getAccessRank(row.businessData || {}) === 3) || null;
    let selectedRow = membershipRows.find((row) => row.businessId === expectedBusinessId) || membershipRows[0];
    if (paidActiveRow && getAccessRank(selectedRow?.businessData || {}) !== 3) {
      selectedRow = paidActiveRow;
    }
    const businessId = selectedRow.businessId;
    const businessData = selectedRow.businessData || {};
    setUserData({ ...businessData, business_id: businessId });
    try {
      localStorage.setItem("activeBusinessId", businessId);
    } catch (_) {}
    console.log("[multi-business] Account activeBusinessId:", businessId);
    return { businessId, businessData };
  }

  const businessRef = collection(db, "users", uid, "businesses");
  let businessSnap = null;
  try {
    businessSnap = await getDocsFromServer(businessRef);
  } catch (_) {
    businessSnap = await getDocs(businessRef);
  }
  if (!businessSnap || businessSnap.empty) {
    return { businessId: expectedBusinessId, businessData: null };
  }

  const docs = businessSnap.docs || [];
  const preferredDoc = expectedBusinessId
    ? docs.find((row) => row.id === expectedBusinessId) || null
    : null;
  const paidActiveDoc = docs.find((row) => getAccessRank(row.data() || {}) === 3) || null;

  let selectedDoc = preferredDoc || docs[0];
  if (paidActiveDoc && getAccessRank(selectedDoc?.data?.() || {}) !== 3) {
    selectedDoc = paidActiveDoc;
  }
  if (!selectedDoc) return { businessId: expectedBusinessId, businessData: null };

  const businessId = selectedDoc.id;
  const businessData = selectedDoc.data() || {};
  setUserData({ ...businessData, business_id: businessId });
  try {
    localStorage.setItem("activeBusinessId", businessId);
  } catch (_) {}

  return { businessId, businessData };
}

function applySubscriptionUi(data) {
  const endDate = resolveEndDate(data);
  console.log("END DATE:", endDate);
  const daysLeft = getDaysLeft(endDate);
  const renewal = endDate instanceof Date && !Number.isNaN(endDate.getTime())
    ? endDate.toLocaleDateString("en-IN")
    : "—";

  const daysEl = document.getElementById("daysLeft");
  const renewalEl = document.getElementById("nextRenewal");
  console.log("ELEMENTS:", daysEl, renewalEl);

  if (daysEl) daysEl.innerText = daysLeft ? `${daysLeft} days left` : "—";
  if (renewalEl) renewalEl.innerText = renewal;
}

function scheduleRender(data) {
  setTimeout(() => applySubscriptionUi(data), 1000);
}

async function initSubscription() {
  onAuthStateChanged(auth, async (user) => {
    console.log("USER:", user);
    if (!user) {
      setUserData(null);
      return;
    }

    try {
      const uid = user.uid;
      const { businessId, businessData } = await resolveBusinessContext(uid);
      latestBusinessId = String(businessId || "").trim();
      latestBusinessData = businessData;

      console.log("BUSINESS ID USED:", latestBusinessId);
      console.log("SNAP:", !!businessData, businessData);
      if (!businessData) {
        setUserData(null);
        console.log("No data");
        return;
      }

      console.log("DATA:", businessData);
      scheduleRender(businessData);
    } catch (err) {
      console.error(err);
    }
  });
}

function bootstrap() {
  console.log("DOM READY ✅");
  initSubscription();
  window.addEventListener("hashchange", () => {
    if (latestBusinessData) scheduleRender(latestBusinessData);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
