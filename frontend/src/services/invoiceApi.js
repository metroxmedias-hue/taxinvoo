import apiClient from './apiClient.js';

export async function createInvoice(payload) {
  const { data } = await apiClient.post('/invoices', payload);
  return data?.data;
}
