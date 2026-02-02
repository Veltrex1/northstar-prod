import { vectorSearch } from './vector-search';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

export interface KnowledgeContext {
  query: string;
  results: Array<{
    documentId: string;
    title: string;
    content: string;
    relevanceScore: number;
    dataType: string;
    sourceUrl?: string;
    authorityWeight: number;
  }>;
  totalResults: number;
}

export async function retrieveKnowledge(
  query: string,
  companyId: string,
  topK: number = 5
): Promise<KnowledgeContext> {
  try {
    const vectorResults = await vectorSearch(query, companyId, topK);

    const enrichedResults = await Promise.all(
      vectorResults.map(async (result) => {
        const document = await prisma.document.findUnique({
          where: { id: result.metadata.documentId },
        });

        const knowledgeEntry = await prisma.knowledgeEntry.findFirst({
          where: { documentId: result.metadata.documentId },
        });

        return {
          documentId: result.metadata.documentId,
          title: result.metadata.title,
          content: result.metadata.content,
          relevanceScore: result.score,
          dataType: result.metadata.dataType,
          sourceUrl: result.metadata.sourceUrl,
          authorityWeight: knowledgeEntry?.authorityWeight || 1.0,
        };
      })
    );

    enrichedResults.sort(
      (a, b) =>
        b.relevanceScore * b.authorityWeight - a.relevanceScore * a.authorityWeight
    );

    return {
      query,
      results: enrichedResults,
      totalResults: enrichedResults.length,
    };
  } catch (error) {
    logger.error('Knowledge retrieval error', error);
    throw error;
  }
}

export async function detectConflicts(
  query: string,
  companyId: string
): Promise<{
  hasConflict: boolean;
  conflictingResults?: Array<{
    documentId: string;
    title: string;
    content: string;
    dataType: string;
  }>;
}> {
  try {
    const knowledge = await retrieveKnowledge(query, companyId, 10);

    if (
      query.toLowerCase().includes('revenue') ||
      query.toLowerCase().includes('profit')
    ) {
      const financialResults = knowledge.results.filter(
        (r) => r.dataType === 'FINANCIAL'
      );

      if (financialResults.length > 1) {
        const numbers = financialResults
          .map((r) => extractNumbers(r.content))
          .flat();

        if (numbers.length > 1) {
          const max = Math.max(...numbers);
          const min = Math.min(...numbers);
          const variance = (max - min) / min;

          if (variance > 0.05) {
            return {
              hasConflict: true,
              conflictingResults: financialResults.map((r) => ({
                documentId: r.documentId,
                title: r.title,
                content: r.content.substring(0, 500),
                dataType: r.dataType,
              })),
            };
          }
        }
      }
    }

    return { hasConflict: false };
  } catch (error) {
    logger.error('Conflict detection error', error);
    return { hasConflict: false };
  }
}

function extractNumbers(text: string): number[] {
  const numberRegex = /\$?[\d,]+(?:\.\d+)?[KMB]?/g;
  const matches = text.match(numberRegex) || [];

  return matches.map((match) => {
    const num = match.replace(/[$,]/g, '');
    const multiplier = num.slice(-1);

    if (multiplier === 'K') {
      return parseFloat(num.slice(0, -1)) * 1000;
    }
    if (multiplier === 'M') {
      return parseFloat(num.slice(0, -1)) * 1000000;
    }
    if (multiplier === 'B') {
      return parseFloat(num.slice(0, -1)) * 1000000000;
    }

    return parseFloat(num);
  });
}
