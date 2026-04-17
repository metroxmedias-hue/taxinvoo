import { HttpError } from './httpError.js';

const CGST_RATE = 0.09;
const SGST_RATE = 0.09;
const IGST_RATE = 0.18;

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function calculateGST(sellerStateCode, buyerStateCode, amount) {
  const taxableAmount = Number(amount);
  if (!Number.isFinite(taxableAmount) || taxableAmount < 0) {
    throw new HttpError(400, 'Amount must be a valid non-negative number.');
  }

  const sellerCode = String(sellerStateCode || '').padStart(2, '0');
  const buyerCode = String(buyerStateCode || '').padStart(2, '0');
  if (!sellerCode || !buyerCode) {
    throw new HttpError(400, 'Both seller and buyer state codes are required for GST calculation.');
  }

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (sellerCode === buyerCode) {
    cgst = round2(taxableAmount * CGST_RATE);
    sgst = round2(taxableAmount * SGST_RATE);
  } else {
    igst = round2(taxableAmount * IGST_RATE);
  }

  const totalTax = round2(cgst + sgst + igst);
  const grandTotal = round2(taxableAmount + totalTax);

  return { cgst, sgst, igst, totalTax, grandTotal };
}
