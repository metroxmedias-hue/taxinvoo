import apiClient from './apiClient.js';

export async function createBusiness(payload) {
  const { data } = await apiClient.post('/business', payload);
  return data?.data;
}

export async function getBusinessById(id) {
  const { data } = await apiClient.get(`/business/${id}`);
  return data?.data;
}

export async function updateBusiness(id, payload) {
  const { data } = await apiClient.put(`/business/${id}`, payload);
  return data?.data;
}
