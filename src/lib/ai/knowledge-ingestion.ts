import { prisma } from '@/lib/db/prisma';
import { upsertVector } from './vector-search';
import { logger } from '@/lib/utils/logger';

export async function vectorizeDocument(documentId: string) {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document || document.isExcluded) {
      return;
    }

    const dataType = classifyDataType(document);

    const knowledgeEntry = await prisma.knowledgeEntry.create({
      data: {
        companyId: document.companyId,
        documentId: document.id,
        content: document.content,
        embedding: '[]', // Placeholder, not stored in DB
        dataType,
        authorityWeight: calculateAuthorityWeight(dataType),
      },
    });

    await upsertVector(knowledgeEntry.id, document.content, {
      documentId: document.id,
      companyId: document.companyId,
      title: document.title,
      dataType,
      sourceUrl: document.sourceUrl || undefined,
    });

    logger.info('Document vectorized', { documentId });

    return knowledgeEntry;
  } catch (error) {
    logger.error('Document vectorization error', { documentId, error });
    throw error;
  }
}

export async function vectorizeAllDocuments(companyId: string) {
  try {
    const documents = await prisma.document.findMany({
      where: {
        companyId,
        isExcluded: false,
      },
    });

    logger.info(
      `Vectorizing ${documents.length} documents for company ${companyId}`
    );

    let successCount = 0;
    let errorCount = 0;

    for (const document of documents) {
      try {
        await vectorizeDocument(document.id);
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(`Failed to vectorize document ${document.id}`, error);
      }
    }

    logger.info('Batch vectorization complete', { successCount, errorCount });

    return { successCount, errorCount, total: documents.length };
  } catch (error) {
    logger.error('Batch vectorization error', error);
    throw error;
  }
}

function classifyDataType(document: any): string {
  const title = document.title.toLowerCase();
  const content = document.content.toLowerCase();

  if (
    title.includes('financial') ||
    title.includes('revenue') ||
    title.includes('budget') ||
    title.includes('invoice') ||
    content.includes('$') ||
    content.includes('profit') ||
    content.includes('loss')
  ) {
    return 'FINANCIAL';
  }

  if (
    title.includes('strategy') ||
    title.includes('roadmap') ||
    title.includes('okr') ||
    title.includes('goals') ||
    content.includes('objective')
  ) {
    return 'STRATEGIC';
  }

  if (
    title.includes('product') ||
    title.includes('feature') ||
    title.includes('spec') ||
    content.includes('requirements')
  ) {
    return 'PRODUCT';
  }

  if (
    title.includes('process') ||
    title.includes('sop') ||
    title.includes('procedure') ||
    content.includes('workflow')
  ) {
    return 'OPERATIONAL';
  }

  return 'COMMUNICATION';
}

function calculateAuthorityWeight(dataType: string): number {
  const weights: Record<string, number> = {
    FINANCIAL: 1.5,
    STRATEGIC: 1.3,
    PRODUCT: 1.0,
    OPERATIONAL: 1.0,
    COMMUNICATION: 0.8,
  };

  return weights[dataType] || 1.0;
}
