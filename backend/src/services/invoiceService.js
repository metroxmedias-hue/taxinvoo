import { db, FieldValue } from '../config/firebase.js';
import { HttpError } from '../utils/httpError.js';
import { calculateGST } from '../utils/gst.js';
import { getBusinessById } from './businessService.js';
import { getCustomerById } from './customerService.js';
import { invoicesColRef } from '../utils/firestorePaths.js';

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export async function createInvoice(payload, tenantUserId, tenantBusinessId) {
  const seller = await getBusinessById(tenantUserId, payload.sellerId);
  if (seller.id !== tenantBusinessId) {
    throw new HttpError(403, 'Seller does not belong to current tenant.');
  }

  const customer = await getCustomerById(payload.customerId, tenantUserId, tenantBusinessId);

  const subtotal = round2(payload.items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const buyerStateCode = String(customer.stateCode || customer.placeOfSupply || '').padStart(2, '0');
  const taxBreakup = calculateGST(seller.stateCode, buyerStateCode, subtotal);

  const invoiceData = {
    invoiceNumber: payload.invoiceNumber,
    sellerId: seller.id,
    customerId: customer.id,
    businessId: tenantBusinessId,
    items: payload.items,
    subtotal,
    taxBreakup,
    totalAmount: taxBreakup.grandTotal,
    placeOfSupply: customer.placeOfSupply || buyerStateCode,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  const ref = invoicesColRef(db, tenantUserId, tenantBusinessId).doc();
  await ref.set(invoiceData);
  return { id: ref.id, ...invoiceData };
}
