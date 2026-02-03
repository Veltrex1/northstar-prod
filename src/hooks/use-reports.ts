'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface BoardReport {
  id: string;
  title: string;
  format: string;
  status: string;
  fileUrl: string;
  generatedAt: string;
}

export function useReports() {
  const { toast } = useToast();
  const [reports, setReports] = useState<BoardReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      const response = await fetch('/api/reports');
      const data = await response.json();

      if (data.success) {
        setReports(data.data.reports || []);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const generateReport = async (params: {
    format: string;
    structure: string;
    focusAreas: string[];
    customPrompt?: string;
  }) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Report generated!',
          description: 'Your board report is ready to download',
        });
        fetchReports();
        return data.data;
      } else {
        toast({
          title: 'Generation failed',
          description: data.error.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate report',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Report deleted',
        });
        fetchReports();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete report',
        variant: 'destructive',
      });
    }
  };

  return {
    reports,
    isLoading,
    generateReport,
    deleteReport,
    refresh: fetchReports,
  };
}
