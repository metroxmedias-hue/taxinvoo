let tenantContext = { businessId: '', userId: '' };

let warnedMissingTenant = false;
let warnedInvalidTenant = false;

export function getTenant() {
  if (!tenantContext.businessId && !warnedMissingTenant) {
    console.info('[tenant] No local tenant context found. Waiting for auth bootstrap to restore it from Firestore.');
    warnedMissingTenant = true;
  }
  return { ...tenantContext };
}

export function setTenant(tenant) {
  tenantContext = {
    businessId: String(tenant?.businessId || '').trim(),
    userId: String(tenant?.userId || '').trim()
  };
  if (!tenantContext.businessId && !warnedInvalidTenant) {
    console.warn('[tenant] Invalid tenant context provided, using empty tenant.');
    warnedInvalidTenant = true;
  } else {
    console.info('[tenant] Tenant context saved:', tenantContext);
  }
  return { ...tenantContext };
}
