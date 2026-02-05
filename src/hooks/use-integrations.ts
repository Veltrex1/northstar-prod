'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { parseApiResponse } from '@/lib/utils/api-client';

export interface Integration {
  id: string;
  platform: string;
  status: 'CONNECTED' | 'SYNCING' | 'ERROR' | 'DISCONNECTED';
  lastSyncAt: string | null;
  metadata?: {
    connectedEmail?: string;
    stats?: {
      documentsCount?: number;
      emailsCount?: number;
      channelsCount?: number;
    };
  };
}

export function useIntegrations() {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchIntegrations = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations');
      const data = await parseApiResponse<{ integrations: Integration[] }>(response);

      if (data.success) {
        setIntegrations(data.data.integrations || []);
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const connectIntegration = async (platform: string) => {
    try {
      const response = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });

      const data = await parseApiResponse<{ authUrl: string }>(response);

      if (data.success) {
        window.location.href = data.data.authUrl;
      } else {
        toast({
          title: 'Connection failed',
          description: data.error.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to initiate connection',
        variant: 'destructive',
      });
    }
  };

  const syncIntegration = async (integrationId: string) => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}/sync`, {
        method: 'POST',
      });

      const data = await parseApiResponse<{ synced: boolean }>(response);

      if (data.success) {
        toast({
          title: 'Sync started',
          description: 'Your data is being synced',
        });
        fetchIntegrations();
      } else {
        toast({
          title: 'Sync failed',
          description: data.error.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sync integration',
        variant: 'destructive',
      });
    }
  };

  const disconnectIntegration = async (integrationId: string) => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}`, {
        method: 'DELETE',
      });

      const data = await parseApiResponse<{ deleted: boolean }>(response);

      if (data.success) {
        toast({
          title: 'Disconnected',
          description: 'Integration has been removed',
        });
        fetchIntegrations();
      } else {
        toast({
          title: 'Disconnect failed',
          description: data.error.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect integration',
        variant: 'destructive',
      });
    }
  };

  return {
    integrations,
    isLoading,
    connectIntegration,
    syncIntegration,
    disconnectIntegration,
    refresh: fetchIntegrations,
  };
}
