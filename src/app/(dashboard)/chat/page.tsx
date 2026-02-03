'use client';

import { useRef, useEffect } from 'react';
import { useChat } from '@/hooks/use-chat';
import { Message } from '@/components/chat/message';
import { MessageInput } from '@/components/chat/message-input';
import { ThinkingIndicator } from '@/components/chat/thinking-indicator';
import { SecondBrainToggle } from '@/components/chat/second-brain-toggle';
import { EmptyState } from '@/components/chat/empty-state';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function ChatPage() {
  const {
    conversation,
    isLoading,
    useSecondBrain,
    sendMessage,
    newConversation,
    toggleSecondBrain,
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

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
