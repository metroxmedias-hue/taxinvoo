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

export function canonicalBusinessDocPath(businessId) {
  return ['businesses', required(businessId, 'businessId')];
}

export function canonicalBusinessesColPath() {
  return ['businesses'];
}

export function businessMemberDocPath(businessId, userId) {
  return [...canonicalBusinessDocPath(businessId), 'members', required(userId, 'userId')];
}

export function businessMembersColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'members'];
}

export function businessIdentityDocPath(identityId) {
  return ['business_identity', required(identityId, 'identityId')];
}

export function canonicalCustomersColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'customers'];
}

export function canonicalCustomerDocPath(businessId, customerId) {
  return [...canonicalCustomersColPath(businessId), required(customerId, 'customerId')];
}

export function canonicalSuppliersColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'suppliers'];
}

export function canonicalProductsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'products'];
}

export function canonicalServicesColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'services'];
}

export function canonicalInvoicesColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'invoices'];
}

export function canonicalInvoiceDocPath(businessId, invoiceId) {
  return [...canonicalInvoicesColPath(businessId), required(invoiceId, 'invoiceId')];
}

export function canonicalQuotationsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'quotations'];
}

export function canonicalPurchasesColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'purchases'];
}

export function canonicalPurchaseOrdersColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'purchase_orders'];
}

export function canonicalPaymentsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'payments'];
}

export function canonicalExpensesColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'expenses'];
}

export function canonicalSalesReturnsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'sales_returns'];
}

export function canonicalPurchaseReturnsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'purchase_returns'];
}

export function canonicalCreditNotesColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'credit_notes'];
}

export function canonicalDebitNotesColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'debit_notes'];
}

export function canonicalDeliveryChallansColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'delivery_challans'];
}

export function canonicalEwayBillsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'eway_bills'];
}

export function canonicalProformaInvoicesColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'proforma_invoices'];
}

export function canonicalStockLocationsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'stock_locations'];
}

export function canonicalLedgerEntriesColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'ledger_entries'];
}

export function canonicalStockMovementsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'stock_movements'];
}

export function canonicalStockBatchesColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'stock_batches'];
}

export function canonicalCashBankAccountsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'cash_bank_accounts'];
}

export function canonicalLedgerAccountsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'ledger_accounts'];
}

export function canonicalGstFilingsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'gst_filings'];
}

export function canonicalNotificationsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'notifications'];
}

export function canonicalAiInsightsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'ai_insights'];
}

export function canonicalAttachmentsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'attachments'];
}

export function canonicalActivitiesColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'activities'];
}

export function canonicalCountersColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'counters'];
}

export function canonicalReportsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'reports'];
}

export function canonicalAuditLogsColPath(businessId) {
  return [...canonicalBusinessDocPath(businessId), 'audit_logs'];
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
