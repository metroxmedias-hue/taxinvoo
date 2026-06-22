const TENANT_STORAGE_KEY = 'metrox_frontend_tenant';

let warnedMissingTenant = false;
let warnedInvalidTenant = false;

export function getTenant() {
  const fallback = { businessId: '', userId: '' };
  try {
    const raw = localStorage.getItem(TENANT_STORAGE_KEY);
    if (!raw) {
      if (!warnedMissingTenant) {
        console.info('[tenant] No local tenant context found. Waiting for auth bootstrap to restore it from Firestore.');
        warnedMissingTenant = true;
      }
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return {
      businessId: String(parsed?.businessId || ''),
      userId: String(parsed?.userId || '')
    };
  } catch (error) {
    if (!warnedInvalidTenant) {
      console.warn('[tenant] Invalid tenant context in localStorage. Falling back to empty tenant.', error);
      warnedInvalidTenant = true;
    }
    return fallback;
  }
}

export function setTenant(tenant) {
  const next = {
    businessId: String(tenant?.businessId || '').trim(),
    userId: String(tenant?.userId || '').trim()
  };
  try {
    localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(next));
    console.info('[tenant] Tenant context saved:', next);
  } catch (error) {
    console.warn('[tenant] Failed to save tenant context:', error);
  }
  return next;
}
