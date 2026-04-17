import { HttpError } from './httpError.js';

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z0-9][A-Z0-9]$/;

const STATE_CODE_MAP = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '28': 'Andhra Pradesh',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
};

export function extractStateCodeFromGSTIN(gstin) {
  if (!gstin) return null;
  const normalized = String(gstin).trim().toUpperCase();
  if (!GSTIN_PATTERN.test(normalized)) {
    throw new HttpError(400, 'Invalid GSTIN format.');
  }
  return normalized.slice(0, 2);
}

export function getStateFromCode(stateCode) {
  if (!stateCode) return null;
  return STATE_CODE_MAP[String(stateCode).padStart(2, '0')] || null;
}

export function normalizeGSTIN(gstin) {
  if (!gstin) return '';
  const normalized = String(gstin).trim().toUpperCase();
  if (!GSTIN_PATTERN.test(normalized)) {
    throw new HttpError(400, 'Invalid GSTIN format.');
  }
  return normalized;
}
