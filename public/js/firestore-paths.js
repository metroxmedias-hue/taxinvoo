function required(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

export function userDocPath(userId) {
  return ['users', required(userId, 'userId')];
}

export function userBusinessesColPath(userId) {
  return [...userDocPath(userId), 'businesses'];
}

export function businessDocPath(userId, businessId) {
  return [...userBusinessesColPath(userId), required(businessId, 'businessId')];
}

export function businessStateDocPath(userId, businessId) {
  return [...businessDocPath(userId, businessId), 'app_meta', 'state'];
}

export function businessInvitesColPath(userId, businessId) {
  return [...businessDocPath(userId, businessId), 'accountant_invites'];
}

export function invoicesColPath(userId, businessId) {
  return [...businessDocPath(userId, businessId), 'invoices'];
}

export function invoiceDocPath(userId, businessId, invoiceId) {
  return [...invoicesColPath(userId, businessId), required(invoiceId, 'invoiceId')];
}

export function paymentsColPath(userId, businessId) {
  return [...businessDocPath(userId, businessId), 'payments'];
}

export function ledgerColPath(userId, businessId) {
  return [...businessDocPath(userId, businessId), 'ledger'];
}

export function customersColPath(userId, businessId) {
  return [...businessDocPath(userId, businessId), 'customers'];
}

export function subscriptionDocPath(userId) {
  return [...userDocPath(userId), 'billing', 'subscription'];
}

export function usageDocPath(userId) {
  return [...userDocPath(userId), 'billing', 'usage'];
}
