'use client';

import { useEffect, useRef } from 'react';
import { useChat } from '@/hooks/use-chat';
import { Message } from '@/components/chat/message';
import { MessageInput } from '@/components/chat/message-input';
import { ThinkingIndicator } from '@/components/chat/thinking-indicator';
import { EmptyState } from '@/components/chat/empty-state';

export default function ChatPage() {
  const { messages, isAIThinking, isSubmitting, sendMessage, input, setInput } =
    useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
