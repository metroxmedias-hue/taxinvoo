function required(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

export function userDocRef(db, userId) {
  return db.collection('users').doc(required(userId, 'userId'));
}

export function businessDocRef(db, userId, businessId) {
  return userDocRef(db, userId).collection('businesses').doc(required(businessId, 'businessId'));
}

export function businessesColRef(db, userId) {
  return userDocRef(db, userId).collection('businesses');
}

export function invoicesColRef(db, userId, businessId) {
  return businessDocRef(db, userId, businessId).collection('invoices');
}

export function invoiceDocRef(db, userId, businessId, invoiceId) {
  return invoicesColRef(db, userId, businessId).doc(required(invoiceId, 'invoiceId'));
}

export function customersColRef(db, userId, businessId) {
  return businessDocRef(db, userId, businessId).collection('customers');
}

export function customerDocRef(db, userId, businessId, customerId) {
  return customersColRef(db, userId, businessId).doc(required(customerId, 'customerId'));
}
