import axios from 'axios';

export const API = axios.create({
  baseURL: '/api',
});

// Interceptor to attach the logged-in tenant's unique identifier and auth token on every request
API.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('danmax_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    const savedUser = localStorage.getItem('danmax_user');
    if (savedUser) {
      const userObj = JSON.parse(savedUser);
      const tenantId = userObj.tenantId || userObj.businessName || 'tenant_demo_pizzeria';
      config.headers['x-tenant-id'] = tenantId;
    } else {
      config.headers['x-tenant-id'] = 'tenant_demo_pizzeria';
    }
  } catch (e) {
    config.headers['x-tenant-id'] = 'tenant_demo_pizzeria';
  }
  return config;
});

