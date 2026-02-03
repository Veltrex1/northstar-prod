'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { EmailDraft } from '@/hooks/use-email';
import {
  Smile,
  Briefcase,
  Minimize2,
  Maximize2,
  Zap,
  Clock,
} from 'lucide-react';

interface DraftEditorProps {
  draft: EmailDraft;
  onModifyTone: (tone: string) => void;
  onSend?: () => void;
  isLoading: boolean;
}

const toneButtons = [
  { tone: 'friendly', label: 'Friendlier', icon: Smile },
  { tone: 'professional', label: 'More Professional', icon: Briefcase },
  { tone: 'concise', label: 'More Concise', icon: Minimize2 },
  { tone: 'detailed', label: 'More Detailed', icon: Maximize2 },
  { tone: 'persuasive', label: 'More Persuasive', icon: Zap },
  { tone: 'urgent', label: 'More Urgent', icon: Clock },
];

export function DraftEditor({
  draft,
  onModifyTone,
  onSend,
  isLoading,
}: DraftEditorProps) {
  const [subject, setSubject] = useState(draft.subject);
  const [content, setContent] = useState(draft.content);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="text-lg font-medium"
          />
        </div>

        <div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={15}
            className="resize-none font-mono text-sm"
          />
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-3">Adjust tone:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {toneButtons.map(({ tone, label, icon: Icon }) => (
              <Button
                key={tone}
                variant="outline"
                size="sm"
                onClick={() => onModifyTone(tone)}
                disabled={isLoading}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        {onSend && (
          <div className="flex justify-end gap-2">
            <Button variant="outline">Save Draft</Button>
            <Button onClick={onSend} disabled={isLoading}>
              Send Email
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
export default function Component() {
  return null;
}
