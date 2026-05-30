import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';

const SOCKET_URL = Platform.OS === 'web' 
  ? 'http://localhost:3000' 
  : 'http://192.168.0.114:3000';

let socket: Socket | null = null;

export const getSocket = (userId: string) => {
  if (!socket) {
    socket = io(SOCKET_URL);
    socket.emit('join', userId);
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
