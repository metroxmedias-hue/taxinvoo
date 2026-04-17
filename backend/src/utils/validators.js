import { HttpError } from './httpError.js';
import { extractStateCodeFromGSTIN, getStateFromCode, normalizeGSTIN } from './gstin.js';

const isNonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const cleanString = (value) => (typeof value === 'string' ? value.trim() : '');

const optionalEmail = (value, fieldName = 'email') => {
  const v = cleanString(value);
  if (!v) return '';
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (!ok) throw new HttpError(400, `Invalid ${fieldName}.`);
  return v.toLowerCase();
};

const optionalPhone = (value) => {
  const v = cleanString(value);
  if (!v) return '';
  const ok = /^[+]?[0-9]{8,15}$/.test(v.replace(/\s+/g, ''));
  if (!ok) throw new HttpError(400, 'Invalid phone number.');
  return v;
};

const assertRequired = (value, fieldName) => {
  if (!isNonEmpty(value)) {
    throw new HttpError(400, `${fieldName} is required.`);
  }
  return cleanString(value);
};

export function validateBusinessPayload(payload, { partial = false } = {}) {
  const body = payload || {};
  const out = {};

  const requiredStringFields = ['businessName', 'ownerName', 'addressLine1', 'city', 'state', 'stateCode', 'pincode', 'country'];
  for (const field of requiredStringFields) {
    if (partial && !(field in body)) continue;
    out[field] = partial ? cleanString(body[field]) : assertRequired(body[field], field);
  }

  const optionalStringFields = ['pan', 'addressLine2', 'logoUrl'];
  for (const field of optionalStringFields) {
    if (partial && !(field in body)) continue;
    out[field] = cleanString(body[field]);
  }

  if (!partial || 'gstin' in body) {
    out.gstin = body.gstin ? normalizeGSTIN(body.gstin) : '';
  }
  if (!partial || 'email' in body) {
    out.email = optionalEmail(body.email);
  }
  if (!partial || 'phone' in body) {
    out.phone = optionalPhone(body.phone);
  }

  if ('stateCode' in out && out.stateCode) {
    if (!/^\d{2}$/.test(out.stateCode)) {
      throw new HttpError(400, 'stateCode must be a 2 digit code.');
    }
  }

  return out;
}

export function validateCustomerPayload(payload, { partial = false } = {}) {
  const body = payload || {};
  const out = {};

  const requiredStringFields = ['customerName', 'billingAddressLine1', 'city', 'state', 'stateCode', 'pincode', 'placeOfSupply'];
  for (const field of requiredStringFields) {
    if (partial && !(field in body)) continue;
    out[field] = partial ? cleanString(body[field]) : assertRequired(body[field], field);
  }

  const optionalStringFields = ['billingAddressLine2'];
  for (const field of optionalStringFields) {
    if (partial && !(field in body)) continue;
    out[field] = cleanString(body[field]);
  }

  if (!partial || 'phone' in body) {
    out.phone = optionalPhone(body.phone);
  }

  if (!partial || 'shippingSameAsBilling' in body) {
    out.shippingSameAsBilling = Boolean(body.shippingSameAsBilling);
  }

  if (!partial || 'shippingAddress' in body) {
    const src = body.shippingAddress && typeof body.shippingAddress === 'object' ? body.shippingAddress : {};
    out.shippingAddress = {
      addressLine1: cleanString(src.addressLine1),
      addressLine2: cleanString(src.addressLine2),
      city: cleanString(src.city),
      state: cleanString(src.state),
      stateCode: cleanString(src.stateCode),
      pincode: cleanString(src.pincode),
      placeOfSupply: cleanString(src.placeOfSupply)
    };
  }

  if (!partial || 'gstin' in body) {
    out.gstin = body.gstin ? normalizeGSTIN(body.gstin) : '';
    if (out.gstin) {
      const gstStateCode = extractStateCodeFromGSTIN(out.gstin);
      out.stateCode = gstStateCode;
      if (!out.state && (!partial || 'state' in body)) {
        out.state = getStateFromCode(gstStateCode) || out.state;
      }
      if (!out.placeOfSupply && (!partial || 'placeOfSupply' in body)) {
        out.placeOfSupply = gstStateCode;
      }
    }
  }

  if ('stateCode' in out && out.stateCode && !/^\d{2}$/.test(out.stateCode)) {
    throw new HttpError(400, 'stateCode must be a 2 digit code.');
  }

  return out;
}

export function validateInvoicePayload(payload) {
  const body = payload || {};
  const invoiceNumber = assertRequired(body.invoiceNumber, 'invoiceNumber');
  const sellerId = assertRequired(body.sellerId, 'sellerId');
  const customerId = assertRequired(body.customerId, 'customerId');

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new HttpError(400, 'items must be a non-empty array.');
  }

  const items = body.items.map((item, index) => {
    const description = assertRequired(item?.description, `items[${index}].description`);
    const quantity = Number(item?.quantity);
    const rate = Number(item?.rate);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new HttpError(400, `items[${index}].quantity must be > 0.`);
    }
    if (!Number.isFinite(rate) || rate < 0) {
      throw new HttpError(400, `items[${index}].rate must be >= 0.`);
    }

    return {
      description,
      quantity,
      rate,
      amount: Math.round((quantity * rate + Number.EPSILON) * 100) / 100
    };
  });

  return {
    invoiceNumber,
    sellerId,
    customerId,
    items
  };
}
