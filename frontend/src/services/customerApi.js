import apiClient from './apiClient.js';

const customerCache = new Map();

export async function createCustomer(payload) {
  const { data } = await apiClient.post('/customers', payload);
  return data?.data;
}

export async function getCustomerById(id) {
  const { data } = await apiClient.get(`/customers/${id}`);
  return data?.data;
}

export function getCachedCustomers(businessId) {
  const key = String(businessId || '').trim();
  if (!key) return [];
  const cached = customerCache.get(key);
  return Array.isArray(cached) ? cached : [];
}

export function cacheCustomer(businessId, customer) {
  const key = String(businessId || '').trim();
  if (!key || !customer || typeof customer !== 'object') return;
  const current = getCachedCustomers(key);
  const next = [customer, ...current.filter((c) => c.id !== customer.id)].slice(0, 50);
  customerCache.set(key, next);
}
