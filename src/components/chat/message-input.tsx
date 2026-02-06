'use client';

import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  isLoading,
  value,
  onChange,
  placeholder = 'Ask Northstar anything...',
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSend(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <form onSubmit={handleSubmit} className="bg-white py-4">
      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="relative rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            className="min-h-[52px] max-h-[200px] resize-none border-none p-0 pr-10 shadow-none focus-visible:ring-0"
            rows={1}
          />
          <Button
            type="submit"
            disabled={!value.trim() || isLoading}
            size="icon"
            className="absolute right-2 top-2 h-9 w-9 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-500">
          Press{' '}
          <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
            Enter
          </kbd>{' '}
          to send
        </p>
      </div>
    </form>
  );
}
