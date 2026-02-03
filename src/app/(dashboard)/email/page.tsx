'use client';

import { useState } from 'react';
import { useEmail } from '@/hooks/use-email';
import { DraftEditor } from '@/components/email/draft-editor';
import { DraftList } from '@/components/email/draft-list';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { PlusCircle, Sparkles, Mail } from 'lucide-react';

export default function EmailPage() {
  const {
    drafts,
    isLoading,
    styleProfile,
    learnStyle,
    generateDraft,
    modifyTone,
    deleteDraft,
  } = useEmail();

  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [newEmailPrompt, setNewEmailPrompt] = useState('');
  const [showNewDraft, setShowNewDraft] = useState(false);

  const handleGenerateNew = async () => {
    const draft = await generateDraft({
      type: 'new',
      prompt: newEmailPrompt,
    });

    if (draft) {
      setSelectedDraft(draft);
      setShowNewDraft(false);
      setNewEmailPrompt('');
    }
  };

  const handleModifyTone = async (tone: string) => {
    if (!selectedDraft) return;
    const updated = await modifyTone(selectedDraft.draftId, tone);
    if (updated) {
      setSelectedDraft(updated);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Email Drafts</h1>
          <p className="text-gray-600">AI-powered email writing</p>
        </div>
        {!styleProfile && (
          <Button onClick={learnStyle} disabled={isLoading}>
            <Sparkles className="w-4 h-4 mr-2" />
            Learn My Style
          </Button>
        )}
      </div>

      {!styleProfile ? (
        <Card className="p-8 text-center">
          <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Learn Your Email Style</h2>
          <p className="text-gray-600 mb-6">
            Northstar will analyze your sent emails to learn your writing style,
            then draft emails that sound like you.
          </p>
          <Button onClick={learnStyle} disabled={isLoading}>
            {isLoading ? 'Analyzing emails...' : 'Get Started'}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left sidebar - Draft list */}
          <div className="space-y-4">
            <Button
              onClick={() => setShowNewDraft(true)}
              className="w-full"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              New Email
            </Button>

            {showNewDraft && (
              <Card className="p-4">
                <p className="text-sm font-medium mb-2">What should this email say?</p>
                <Textarea
                  value={newEmailPrompt}
                  onChange={(e) => setNewEmailPrompt(e.target.value)}
                  placeholder="E.g., 'Draft an email to investors about our Q4 results'"
                  rows={4}
                />
                <div className="flex gap-2 mt-3">
                  <Button onClick={handleGenerateNew} disabled={isLoading} size="sm">
                    Generate
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowNewDraft(false)}
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </Card>
            )}

            <DraftList
              drafts={drafts}
              onSelect={setSelectedDraft}
              onDelete={deleteDraft}
            />
          </div>

          {/* Main area - Draft editor */}
          <div className="lg:col-span-2">
            {selectedDraft ? (
              <DraftEditor
                draft={selectedDraft}
                onModifyTone={handleModifyTone}
                isLoading={isLoading}
              />
            ) : (
              <Card className="p-12 text-center">
                <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Select a draft or create a new one</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
