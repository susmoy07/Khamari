import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef } from 'react';
import { API_BASE, getToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE || undefined, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({ token: getToken() }),
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (s.connected) s.disconnect();
  s.connect();
}

export function disconnectSocket() {
  socket?.disconnect();
}

export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    const fn = (p: T) => ref.current(p);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [event]);
}
