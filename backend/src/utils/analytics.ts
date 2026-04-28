import axios from 'axios';

export const trackEvent = async (event: string, distinctId: string, properties: Record<string, any> = {}) => {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return;

  const host = process.env.POSTHOG_HOST || 'https://app.posthog.com';
  const url = `${host.replace(/\/$/, '')}/capture/`;

  await axios.post(url, {
    api_key: apiKey,
    event,
    distinct_id: distinctId,
    properties,
  });
};
