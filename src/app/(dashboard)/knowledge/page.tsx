'use client';

import { useKnowledge } from '@/hooks/use-knowledge';
import { DocumentCard } from '@/components/knowledge/document-card';
import { KnowledgeStats } from '@/components/knowledge/knowledge-stats';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Database } from 'lucide-react';

export default function KnowledgePage() {
  const {
    documents,
    isLoading,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    excludeDocument,
  } = useKnowledge();

  // Calculate stats
  const stats = {
    total: documents.length,
    byType: documents.reduce((acc, doc) => {
      const type = doc.contentType.split('/')[0] || 'other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byIntegration: {},
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Knowledge Bank</h1>
        <p className="text-gray-600">
          Browse all documents in your company's knowledge base
        </p>
      </div>

      <KnowledgeStats
        totalDocuments={stats.total}
        byType={stats.byType}
        byIntegration={stats.byIntegration}
      />

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select
          value={filters.dataType || "ALL"}
          onValueChange={(value) =>
            setFilters({ ...filters, dataType: value === "ALL" ? "" : value })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="FINANCIAL">Financial</SelectItem>
            <SelectItem value="STRATEGIC">Strategic</SelectItem>
            <SelectItem value="PRODUCT">Product</SelectItem>
            <SelectItem value="OPERATIONAL">Operational</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No documents found</h3>
          <p className="text-gray-600">
            {searchQuery || filters.dataType
              ? 'Try adjusting your search or filters'
              : 'Connect integrations to start building your knowledge bank'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              onExclude={() => excludeDocument(document.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
