'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEmail } from '@/hooks/use-email';
import { useIntegrations } from '@/hooks/use-integrations';
import { DraftEditor } from '@/components/email/draft-editor';
import { DraftList } from '@/components/email/draft-list';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlusCircle, Sparkles, Mail } from 'lucide-react';

export default function EmailPage() {
  const router = useRouter();
  const {
    drafts,
    isLoading,
    styleProfile,
    learnStyle,
    generateDraft,
    modifyTone,
    deleteDraft,
  } = useEmail();
  const { integrations } = useIntegrations();

  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [newEmailPrompt, setNewEmailPrompt] = useState('');
  const [showNewDraft, setShowNewDraft] = useState(false);
  const [showProviderDialog, setShowProviderDialog] = useState(false);

  const emailProviders = useMemo(
    () =>
      integrations.filter(
        (integration) =>
          integration.status === 'CONNECTED' &&
          (integration.platform === 'GOOGLE_WORKSPACE' ||
            integration.platform === 'MICROSOFT_365')
      ),
    [integrations]
  );
  const hasEmailProvider = emailProviders.length > 0;

  const handleLearnStyle = () => {
    if (!hasEmailProvider) {
      router.push('/settings/integrations');
      return;
    }

    if (emailProviders.length === 1) {
      learnStyle(emailProviders[0].platform as 'GOOGLE_WORKSPACE' | 'MICROSOFT_365');
      return;
    }

    setShowProviderDialog(true);
  };

  const handleProviderChoice = (platform: 'GOOGLE_WORKSPACE' | 'MICROSOFT_365') => {
    setShowProviderDialog(false);
    learnStyle(platform);
  };

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
          <Button onClick={handleLearnStyle} disabled={isLoading}>
            <Sparkles className="w-4 h-4 mr-2" />
            {hasEmailProvider ? 'Learn My Style' : 'Connect Email Provider'}
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
          <Button onClick={handleLearnStyle} disabled={isLoading}>
            {hasEmailProvider
              ? isLoading
                ? 'Analyzing emails...'
                : 'Get Started'
              : 'Connect Email Provider'}
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

      <Dialog open={showProviderDialog} onOpenChange={setShowProviderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose an email provider</DialogTitle>
            <DialogDescription>
              Select which provider to learn your writing style from.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {emailProviders.map((provider) => (
              <Button
                key={provider.id}
                variant="outline"
                onClick={() =>
                  handleProviderChoice(
                    provider.platform as 'GOOGLE_WORKSPACE' | 'MICROSOFT_365'
                  )
                }
              >
                {provider.platform === 'GOOGLE_WORKSPACE'
                  ? 'Google Workspace (Gmail)'
                  : 'Microsoft 365 (Outlook)'}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
