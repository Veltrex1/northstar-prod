'use client';

import { useState, useCallback } from 'react';
import { parseApiResponse } from '@/lib/utils/api-client';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: Array<{
    documentId: string;
    title: string;
    url?: string;
    excerpt: string;
  }>;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  useSecondBrain: boolean;
}

export function useChat() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [useSecondBrain, setUseSecondBrain] = useState(true);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return;

      setIsLoading(true);

      const userMessage: Message = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };

      setConversation((prev) => ({
        ...prev!,
        messages: [...(prev?.messages || []), userMessage],
      }));

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: conversation?.id,
            message,
            useSecondBrain,
          }),
        });

        const data = await parseApiResponse<{
          response: string;
          sources?: Message['sources'];
          conversationId: string;
        }>(response);

        if (data.success) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: data.data.response,
            timestamp: new Date().toISOString(),
            sources: data.data.sources,
          };

          setConversation({
            id: data.data.conversationId,
            title: conversation?.title || message.substring(0, 50),
            messages: [...(conversation?.messages || []), userMessage, assistantMessage],
            useSecondBrain,
          });
        }
      } catch (error) {
        console.error('Failed to send message:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [conversation, useSecondBrain]
  );

  const newConversation = useCallback(() => {
    setConversation(null);
  }, []);

  const toggleSecondBrain = useCallback(() => {
    setUseSecondBrain((prev) => !prev);
  }, []);

  return {
    conversation,
    isLoading,
    useSecondBrain,
    sendMessage,
    newConversation,
    toggleSecondBrain,
  };
}
