'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';

export type SourceType =
  | 'google_drive'
  | 'slack'
  | 'salesforce'
  | 'quickbooks'
  | 'other';

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  documentId?: string;
  title?: string;
  excerpt?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'error';
  sources?: Source[];
  error?: { message: string; retryable: boolean };
}

type IncomingMessage =
  | { type: 'thinking'; data: { state: string; message: string } }
  | { type: 'delta'; data: { content: string } }
  | { type: 'source'; data: Partial<Source> & { name: string } }
  | { type: 'complete'; data: { messageId?: string; sources?: Source[] } }
  | { type: 'error'; data: { message: string; retryable?: boolean } };

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [thinkingState, setThinkingState] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sessionId = useMemo(() => crypto.randomUUID(), []);
  const { isConnected, sendMessage: sendSocketMessage, lastMessage } =
    useWebSocket(sessionId);

  const activeAssistantIdRef = useRef<string | null>(null);
  const pendingSourcesRef = useRef<Source[]>([]);

  const ensureAssistantMessage = useCallback(() => {
    if (activeAssistantIdRef.current) {
      return activeAssistantIdRef.current;
    }

    const messageId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: messageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'sending',
    };

    activeAssistantIdRef.current = messageId;
    setMessages((prev) => [...prev, assistantMessage]);

    return messageId;
  }, []);

  const updateMessage = useCallback((id: string, updater: (prev: Message) => Message) => {
    setMessages((prev) => prev.map((message) => (message.id === id ? updater(message) : message)));
  }, []);

  const markMessageError = useCallback(
    (id: string, message: string, retryable = true) => {
      updateMessage(id, (prev) => ({
        ...prev,
        status: 'error',
        error: { message, retryable },
      }));
    },
    [updateMessage]
  );

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;

      const messageId = crypto.randomUUID();
      const userMessage: Message = {
        id: messageId,
        role: 'user',
        content,
        timestamp: new Date(),
        status: 'sending',
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsSubmitting(true);
      setIsAIThinking(true);
      setThinkingState('Thinking...');

      if (!isConnected) {
        markMessageError(messageId, 'Connection lost. Retrying when reconnected.', true);
        setIsSubmitting(false);
        setIsAIThinking(false);
        setThinkingState('Connection lost');
        return;
      }

      sendSocketMessage({
        type: 'message',
        content,
        sessionId,
      });

      updateMessage(messageId, (prev) => ({ ...prev, status: 'sent' }));
      setIsSubmitting(false);
    },
    [isConnected, markMessageError, sendSocketMessage, sessionId, updateMessage]
  );

  const retryMessage = useCallback(
    (id: string) => {
      const message = messages.find((item) => item.id === id);
      if (!message || message.role !== 'user') return;
      if (message.status !== 'error' || message.error?.retryable === false) return;

      updateMessage(id, (prev) => ({ ...prev, status: 'sending', error: undefined }));
      setIsSubmitting(true);
      sendSocketMessage({ type: 'message', content: message.content, sessionId });
      updateMessage(id, (prev) => ({ ...prev, status: 'sent' }));
      setIsSubmitting(false);
    },
    [messages, sendSocketMessage, sessionId, updateMessage]
  );

  const regenerateResponse = useCallback(
    (id: string) => {
      setIsAIThinking(true);
      setThinkingState('Regenerating response...');
      activeAssistantIdRef.current = id;
      updateMessage(id, (prev) => ({
        ...prev,
        status: 'sending',
        content: '',
        sources: [],
        error: undefined,
      }));

      sendSocketMessage({ type: 'regenerate', messageId: id, sessionId });
    },
    [sendSocketMessage, sessionId, updateMessage]
  );

  useEffect(() => {
    if (!lastMessage) return;

    let parsed: IncomingMessage | null = null;
    try {
      parsed = JSON.parse(lastMessage.data);
    } catch {
      return;
    }

    if (!parsed) return;

    switch (parsed.type) {
      case 'thinking': {
        setIsAIThinking(true);
        setThinkingState(parsed.data.message);
        break;
      }
      case 'delta': {
        const assistantId = ensureAssistantMessage();
        setIsAIThinking(true);
        setThinkingState('');
        updateMessage(assistantId, (prev) => ({
          ...prev,
          content: `${prev.content}${parsed.data.content}`,
        }));
        break;
      }
      case 'source': {
        const source: Source = {
          id: parsed.data.id ?? crypto.randomUUID(),
          name: parsed.data.name,
          type: parsed.data.type ?? 'other',
          url: parsed.data.url ?? '#',
          documentId: parsed.data.documentId,
          title: parsed.data.title ?? parsed.data.name,
          excerpt: parsed.data.excerpt ?? '',
        };
        pendingSourcesRef.current = [...pendingSourcesRef.current, source];
        break;
      }
      case 'complete': {
        const assistantId = activeAssistantIdRef.current;
        if (assistantId) {
          updateMessage(assistantId, (prev) => ({
            ...prev,
            id: parsed.data.messageId ?? prev.id,
            status: 'sent',
            sources: parsed.data.sources ?? pendingSourcesRef.current,
          }));
        }
        pendingSourcesRef.current = [];
        activeAssistantIdRef.current = null;
        setIsAIThinking(false);
        setThinkingState('');
        break;
      }
      case 'error': {
        const assistantId = activeAssistantIdRef.current;
        if (assistantId) {
          markMessageError(assistantId, parsed.data.message, parsed.data.retryable ?? true);
        }
        setIsAIThinking(false);
        setThinkingState('');
        break;
      }
      default:
        break;
    }
  }, [ensureAssistantMessage, lastMessage, markMessageError, updateMessage]);

  return {
    messages,
    input,
    setInput,
    sendMessage,
    isAIThinking,
    thinkingState,
    isSubmitting,
    retryMessage,
    regenerateResponse,
  };
}
