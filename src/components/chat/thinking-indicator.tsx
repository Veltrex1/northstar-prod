import { Loader2 } from 'lucide-react';

interface ThinkingIndicatorProps {
  message?: string;
}

export function ThinkingIndicator({ message }: ThinkingIndicatorProps) {
  return (
    <div className="flex items-center gap-2 p-4 bg-gray-50">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
      <span className="text-sm text-gray-600">
        {message || 'Northstar is thinking...'}
      </span>
    </div>
  );
}
