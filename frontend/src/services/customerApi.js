import apiClient from './apiClient.js';

export async function createCustomer(payload) {
  const { data } = await apiClient.post('/customers', payload);
  return data?.data;
}

export async function getCustomerById(id) {
  const { data } = await apiClient.get(`/customers/${id}`);
  return data?.data;
}

export function getCachedCustomers(businessId) {
  try {
    const raw = localStorage.getItem(`metrox_cached_customers_${businessId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function cacheCustomer(businessId, customer) {
  const current = getCachedCustomers(businessId);
  const next = [customer, ...current.filter((c) => c.id !== customer.id)].slice(0, 50);
  localStorage.setItem(`metrox_cached_customers_${businessId}`, JSON.stringify(next));
}
