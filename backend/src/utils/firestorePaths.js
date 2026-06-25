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

export function canonicalBusinessDocRef(db, businessId) {
  return db.collection('businesses').doc(required(businessId, 'businessId'));
}

export function canonicalBusinessesColRef(db) {
  return db.collection('businesses');
}

export function businessMemberDocRef(db, businessId, userId) {
  return canonicalBusinessDocRef(db, businessId).collection('members').doc(required(userId, 'userId'));
}

export function businessMembersColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('members');
}

export function businessIdentityDocRef(db, identityId) {
  return db.collection('business_identity').doc(required(identityId, 'identityId'));
}

export function canonicalCustomersColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('customers');
}

export function canonicalCustomerDocRef(db, businessId, customerId) {
  return canonicalCustomersColRef(db, businessId).doc(required(customerId, 'customerId'));
}

export function canonicalSupplierPaymentsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('supplier_payments');
}

export function canonicalSuppliersColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('suppliers');
}

export function canonicalInvoicesColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('invoices');
}

export function canonicalInvoiceDocRef(db, businessId, invoiceId) {
  return canonicalInvoicesColRef(db, businessId).doc(required(invoiceId, 'invoiceId'));
}

export function canonicalPaymentsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('payments');
}

export function canonicalQuotationsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('quotations');
}

export function canonicalPurchasesColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('purchases');
}

export function canonicalPurchaseOrdersColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('purchase_orders');
}

export function canonicalProductsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('products');
}

export function canonicalServicesColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('services');
}

export function canonicalExpensesColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('expenses');
}

export function canonicalSalesReturnsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('sales_returns');
}

export function canonicalPurchaseReturnsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('purchase_returns');
}

export function canonicalCreditNotesColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('credit_notes');
}

export function canonicalDebitNotesColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('debit_notes');
}

export function canonicalDeliveryChallansColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('delivery_challans');
}

export function canonicalEwayBillsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('eway_bills');
}

export function canonicalProformaInvoicesColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('proforma_invoices');
}

export function canonicalStockLocationsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('stock_locations');
}

export function canonicalLedgerEntriesColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('ledger_entries');
}

export function canonicalStockMovementsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('stock_movements');
}

export function canonicalStockBatchesColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('stock_batches');
}

export function canonicalCashBankAccountsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('cash_bank_accounts');
}

export function canonicalLedgerAccountsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('ledger_accounts');
}

export function canonicalCountersColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('counters');
}

export function canonicalReportsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('reports');
}

export function canonicalAuditLogsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('audit_logs');
}

export function canonicalGstFilingsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('gst_filings');
}

export function canonicalNotificationsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('notifications');
}

export function canonicalAiInsightsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('ai_insights');
}

export function canonicalAttachmentsColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('attachments');
}

export function canonicalActivitiesColRef(db, businessId) {
  return canonicalBusinessDocRef(db, businessId).collection('activities');
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
