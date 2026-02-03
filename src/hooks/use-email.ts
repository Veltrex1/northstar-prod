'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface EmailDraft {
  id: string;
  subject: string;
  content: string;
  tone?: string;
  status: string;
  createdAt: string;
}

export function useEmail() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [styleProfile, setStyleProfile] = useState<any>(null);

  const fetchDrafts = useCallback(async () => {
    try {
      const response = await fetch('/api/email/drafts');
      const data = await response.json();

      if (data.success) {
        setDrafts(data.data.drafts || []);
      }
    } catch (error) {
      console.error('Failed to fetch drafts:', error);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const learnStyle = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/email/learn', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setStyleProfile(data.data.profile);
        toast({
          title: 'Style learned!',
          description: 'Northstar has analyzed your email style',
        });
      } else {
        toast({
          title: 'Learning failed',
          description: data.error.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to learn email style',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateDraft = async (params: {
    type: 'new' | 'reply';
    prompt?: string;
    originalEmail?: any;
    tone?: string;
  }) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/email/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Draft created',
          description: 'Your email draft is ready',
        });
        fetchDrafts();
        return data.data;
      } else {
        toast({
          title: 'Draft failed',
          description: data.error.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate draft',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const modifyTone = async (draftId: string, tone: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/email/drafts/${draftId}/tone`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Tone modified',
          description: 'Your draft has been updated',
        });
        fetchDrafts();
        return data.data;
      } else {
        toast({
          title: 'Modification failed',
          description: data.error.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to modify tone',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDraft = async (draftId: string) => {
    try {
      const response = await fetch(`/api/email/drafts/${draftId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Draft deleted',
        });
        fetchDrafts();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete draft',
        variant: 'destructive',
      });
    }
  };

  return {
    drafts,
    isLoading,
    styleProfile,
    learnStyle,
    generateDraft,
    modifyTone,
    deleteDraft,
    refresh: fetchDrafts,
  };
}
