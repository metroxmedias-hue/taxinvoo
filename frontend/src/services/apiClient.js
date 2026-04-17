import axios from 'axios';
import { getTenant } from '../utils/tenant.js';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: 15000
});

apiClient.interceptors.request.use((config) => {
  const tenant = getTenant();
  config.headers = {
    ...config.headers,
    'x-business-id': tenant.businessId || 'pending-business',
    'x-user-id': tenant.userId || 'pending-user'
  };
  return config;
});

export default apiClient;
