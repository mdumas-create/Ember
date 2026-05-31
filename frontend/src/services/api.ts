import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Use localhost for web, IP for mobile
const envUrl = (process as any)?.env?.EXPO_PUBLIC_API_URL as string | undefined;
console.log('API URL Source:', envUrl ? 'Environment' : 'Fallback');
console.log('API URL Value:', envUrl || 'http://localhost:3000/api');

const API_URL = envUrl
  ? envUrl
  : Platform.OS === 'web'
    ? 'http://localhost:3000/api'
    : 'http://192.168.0.114:3000/api';

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
