'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@/hooks/use-chat';
import { useAuth } from '@/hooks/use-auth';
import { parseApiResponse } from '@/lib/utils/api-client';
import { Message } from '@/components/chat/message';
import { MessageInput } from '@/components/chat/message-input';
import { ThinkingIndicator } from '@/components/chat/thinking-indicator';
import { EmptyState } from '@/components/chat/empty-state';

type DailyDigestRecord = {
  id: string;
  date: string;
  content: Record<string, unknown> | null;
  dismissedAt: string | null;
};

export default function ChatPage() {
  const { messages, isAIThinking, isSubmitting, sendMessage, input, setInput } =
    useChat();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [digest, setDigest] = useState<DailyDigestRecord | null>(null);
  const [isDigestLoading, setIsDigestLoading] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = (message: string) => {
    sendMessage(message);
    setInput('');
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    const loadDigest = async () => {
      try {
        const response = await fetch('/api/digest/today');
        const data = await parseApiResponse<{ digest: DailyDigestRecord | null }>(response);
        if (data.success && isMounted) {
          setDigest(data.data.digest ?? null);
        }
      } catch {
        // Ignore fetch errors for now.
      } finally {
        if (isMounted) {
          setIsDigestLoading(false);
        }
      }
    };

    loadDigest();

    return () => {
      isMounted = false;
    };
  }, []);

  const shouldShowDigest =
    Boolean(user?.onboardingCompleted) &&
    !isDigestLoading &&
    digest?.content &&
    !digest.dismissedAt;

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 ? (
        <EmptyState
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          isSubmitting={isSubmitting}
        />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <div>
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
              {isAIThinking && <ThinkingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <MessageInput
            onSend={handleSend}
            isLoading={isSubmitting}
            value={input}
            onChange={setInput}
          />
        </>
      )}
    </div>
  );
}
