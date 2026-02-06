'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat } from '@/hooks/use-chat';
import { useAuth } from '@/hooks/use-auth';
import { parseApiResponse } from '@/lib/utils/api-client';
import { Message } from '@/components/chat/message';
import { MessageInput } from '@/components/chat/message-input';
import { ThinkingIndicator } from '@/components/chat/thinking-indicator';
import { SecondBrainToggle } from '@/components/chat/second-brain-toggle';
import { EmptyState } from '@/components/chat/empty-state';
import { DailyDigest } from '@/components/digest/daily-digest';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

type DailyDigestRecord = {
  id: string;
  date: string;
  content: Record<string, unknown> | null;
  dismissedAt: string | null;
};

export default function ChatPage() {
  const {
    conversation,
    isLoading,
    useSecondBrain,
    sendMessage,
    newConversation,
    toggleSecondBrain,
  } = useChat();
  const { user } = useAuth();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [digest, setDigest] = useState<DailyDigestRecord | null>(null);
  const [isDigestLoading, setIsDigestLoading] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

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
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold">
          {conversation?.title || 'New Chat'}
        </h1>
        <Button variant="outline" size="sm" onClick={newConversation}>
          <PlusCircle className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {shouldShowDigest && <DailyDigest />}

      {/* Second Brain toggle */}
      <SecondBrainToggle enabled={useSecondBrain} onToggle={toggleSecondBrain} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {!conversation || conversation.messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div>
            {conversation.messages.map((message, index) => (
              <Message key={index} message={message} />
            ))}
            {isLoading && <ThinkingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}
