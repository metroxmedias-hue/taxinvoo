const TENANT_STORAGE_KEY = 'metrox_frontend_tenant';

export function getTenant() {
  const fallback = { businessId: '', userId: '' };
  try {
    const raw = localStorage.getItem(TENANT_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      businessId: String(parsed?.businessId || ''),
      userId: String(parsed?.userId || '')
    };
  } catch {
    return fallback;
  }
}

export function setTenant(tenant) {
  const next = {
    businessId: String(tenant?.businessId || '').trim(),
    userId: String(tenant?.userId || '').trim()
  };
  localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(next));
  return next;
}
