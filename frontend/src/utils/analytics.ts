import api from '../services/api';

export const trackEvent = async (event: string, properties: Record<string, any> = {}) => {
  try {
    await api.post('analytics/event', { event, properties });
  } catch (error) {
    console.warn('Failed to track event:', event, error);
  }
};

