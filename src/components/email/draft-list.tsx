import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmailDraft } from '@/hooks/use-email';
import { Mail, Trash2 } from 'lucide-react';

interface DraftListProps {
  drafts: EmailDraft[];
  onSelect: (draft: EmailDraft) => void;
  onDelete: (draftId: string) => void;
}

export function DraftList({ drafts, onSelect, onDelete }: DraftListProps) {
  if (drafts.length === 0) {
    return (
      <div className="text-center py-12">
        <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No drafts yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {drafts.map((draft) => (
        <Card
          key={draft.id}
          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onSelect(draft)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{draft.subject}</p>
              <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                {draft.content}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {new Date(draft.createdAt).toLocaleString()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(draft.id);
              }}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
export default function Component() {
  return null;
}
