import { FileText, ExternalLink } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SourceCitationProps {
  source: {
    documentId: string;
    title: string;
    url?: string;
    excerpt: string;
  };
}

export function SourceCitation({ source }: SourceCitationProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors">
            <FileText className="w-3 h-3" />
            <span className="max-w-[150px] truncate">{source.title}</span>
            {source.url && <ExternalLink className="w-3 h-3" />}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <p className="font-medium mb-1">{source.title}</p>
          <p className="text-xs text-gray-600">{source.excerpt}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
