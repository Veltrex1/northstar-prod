'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { parseApiResponse } from '@/lib/utils/api-client';

export interface Document {
  id: string;
  title: string;
  contentType: string;
  sourceUrl?: string;
  createdAt: string;
  isExcluded: boolean;
}

export function useKnowledge() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    dataType: '',
    integration: '',
  });

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.dataType) params.append('dataType', filters.dataType);
      if (filters.integration) params.append('integration', filters.integration);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/documents?${params.toString()}`);
      const data = await parseApiResponse<{ documents: Document[] }>(response);

      if (data.success) {
        setDocuments(data.data.documents || []);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, searchQuery]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const excludeDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/exclude`, {
        method: 'PATCH',
      });

      const data = await parseApiResponse<{
        documents?: Document[];
        document?: Document;
      }>(response);

      if (data.success) {
        toast({
          title: 'Document excluded',
          description: 'This document will not be used by the AI',
        });
        fetchDocuments();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to exclude document',
        variant: 'destructive',
      });
    }
  };

  return {
    documents,
    isLoading,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    excludeDocument,
    refresh: fetchDocuments,
  };
}
