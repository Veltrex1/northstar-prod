import { cn } from '@/lib/utils';
import { Message as MessageType } from '@/hooks/use-chat';
import { User, Sparkles } from 'lucide-react';
import { SourceCitation } from './source-citation';

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 p-4',
        isUser ? 'bg-white' : 'bg-gray-50'
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-primary' : 'bg-gradient-to-br from-purple-500 to-blue-500'
        )}
      >
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Sparkles className="w-5 h-5 text-white" />
        )}
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {isUser ? 'You' : 'Northstar'}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>

        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.sources.map((source, index) => (
              <SourceCitation key={index} source={source} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
