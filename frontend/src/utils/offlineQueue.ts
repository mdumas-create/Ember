import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const QUEUE_KEY = 'offline_action_queue';

interface OfflineAction {
  id: string;
  type: 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: any;
  timestamp: number;
}

export const addToQueue = async (action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
  const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: OfflineAction[] = queueJson ? JSON.parse(queueJson) : [];
  
  const newAction: OfflineAction = {
    ...action,
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
  };

  queue.push(newAction);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return newAction;
};

export const processQueue = async () => {
  const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
  if (!queueJson) return;

  let queue: OfflineAction[] = JSON.parse(queueJson);
  if (queue.length === 0) return;

  const failedActions: OfflineAction[] = [];

  for (const action of queue) {
    try {
      if (action.type === 'POST') {
        await api.post(action.url, action.data);
      } else if (action.type === 'PUT') {
        await api.put(action.url, action.data);
      } else if (action.type === 'DELETE') {
        await api.delete(action.url);
      }
    } catch (error) {
      console.error(`Failed to process offline action ${action.id}:`, error);
      failedActions.push(action);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failedActions));
};

export const clearQueue = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};
