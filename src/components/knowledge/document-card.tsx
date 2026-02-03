import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Document } from '@/hooks/use-knowledge';
import { FileText, ExternalLink, EyeOff } from 'lucide-react';

interface DocumentCardProps {
  document: Document;
  onExclude: () => void;
}

export function DocumentCard({ document, onExclude }: DocumentCardProps) {
  return (
    <Card className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-blue-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">{document.title}</h3>
            {document.isExcluded && (
              <Badge variant="secondary">Excluded</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Badge variant="outline" className="text-xs">
              {document.contentType}
            </Badge>
            <span>•</span>
            <span>{new Date(document.createdAt).toLocaleDateString()}</span>
          </div>
          {document.sourceUrl && (
            <a
              href={document.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
            >
              View source
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onExclude}
          disabled={document.isExcluded}
        >
          <EyeOff className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
export default function Component() {
  return null;
}
