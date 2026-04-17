export function extractStateCodeFromGSTIN(gstin) {
  const normalized = String(gstin || '').trim().toUpperCase();
  if (!normalized) return '';
  if (!/^\d{2}[A-Z0-9]{13}$/.test(normalized)) return '';
  return normalized.slice(0, 2);
}
