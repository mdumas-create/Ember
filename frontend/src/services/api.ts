import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Ensure the URL always includes /api/ even if the environment variable misses it
let baseUrl = (process.env.EXPO_PUBLIC_API_URL || 'https://ember-backend-dpn8.onrender.com/api').trim();

if (!baseUrl.toLowerCase().includes('/api')) {
  baseUrl = baseUrl.replace(/\/$/, '') + '/api';
}

const API_URL = baseUrl.replace(/\/$/, '') + '/';

console.log('--- API DEBUG ---');
console.log('Platform:', Platform.OS);
console.log('Final API_URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  let token;
  if (Platform.OS === 'web') {
    token = localStorage.getItem('accessToken');
  } else {
    token = await SecureStore.getItemAsync('accessToken');
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('API Request:', config.method?.toUpperCase(), config.url, 'Token:', token.substring(0, 10) + '...');
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  return response;
}, async (error) => {
  if (error.response?.status === 403 || error.response?.status === 401) {
    console.warn('Auth Error:', error.response.status, error.config.url);
  }
  return Promise.reject(error);
});

export default api;
