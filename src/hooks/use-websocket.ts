'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 15000;

const getWebSocketUrl = (sessionId: string) => {
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/api/chat/${sessionId}`;
};

export function useWebSocket(sessionId: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const connect = useCallback(() => {
    if (!sessionId) return;

    cleanupReconnectTimeout();

    const url = getWebSocketUrl(sessionId);
    if (!url) return;

    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    socket.onmessage = (event) => {
      setLastMessage(event);
    };

    socket.onclose = () => {
      setIsConnected(false);
      socketRef.current = null;

      if (!shouldReconnectRef.current) return;
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;

      reconnectAttemptsRef.current += 1;
      const delay = Math.min(
        BASE_RECONNECT_DELAY_MS * 2 ** (reconnectAttemptsRef.current - 1),
        MAX_RECONNECT_DELAY_MS
      );

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [sessionId]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      cleanupReconnectTimeout();
      socketRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((data: unknown) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify(data));
  }, []);

  return {
    isConnected,
    sendMessage,
    lastMessage,
  };
}
