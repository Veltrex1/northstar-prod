import { Pinecone } from '@pinecone-database/pinecone';
import { generateEmbedding } from './embeddings';
import { logger } from '@/lib/utils/logger';

const controllerHostUrl =
  process.env.PINECONE_CONTROLLER_HOST_URL ||
  (process.env.PINECONE_ENVIRONMENT
    ? `https://controller.${process.env.PINECONE_ENVIRONMENT}.pinecone.io`
    : undefined);

if (!controllerHostUrl) {
  throw new Error(
    "Missing Pinecone controller host URL. Set PINECONE_CONTROLLER_HOST_URL (recommended) or PINECONE_ENVIRONMENT."
  );
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
  controllerHostUrl,
});

const indexName = process.env.PINECONE_INDEX || 'northstar-knowledge';
let cachedIndexHost: string | undefined;

export async function initializePineconeIndex() {
  try {
    const indexes = await pinecone.listIndexes();
    const indexExists = indexes.indexes?.some((idx) => idx.name === indexName);

    if (!indexExists) {
      await pinecone.createIndex({
        name: indexName,
        dimension: 1536, // OpenAI text-embedding-3-small dimension
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });
      logger.info('Pinecone index created');
    }
  } catch (error) {
    logger.error('Pinecone initialization error', error);
    throw error;
  }
}

async function resolveIndexHost(): Promise<string | undefined> {
  if (cachedIndexHost) return cachedIndexHost;

  const indexHost = process.env.PINECONE_INDEX_HOST;
  if (indexHost) {
    cachedIndexHost = indexHost;
    return indexHost;
  }

  if (typeof pinecone.describeIndex === "function") {
    const description = await pinecone.describeIndex(indexName);
    const host =
      (description as { host?: string }).host ||
      (description as { status?: { host?: string } }).status?.host ||
      (description as { database?: { host?: string } }).database?.host;

    if (host) {
      cachedIndexHost = host;
      return host;
    }
  }

  return undefined;
}

export async function getIndex() {
  const indexHost = await resolveIndexHost();
  return indexHost ? pinecone.index(indexName, indexHost) : pinecone.index(indexName);
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: {
    documentId: string;
    companyId: string;
    title: string;
    content: string;
    dataType: string;
    sourceUrl?: string;
  };
}

export async function vectorSearch(
  query: string,
  companyId: string,
  topK: number = 5
): Promise<VectorSearchResult[]> {
  try {
    const index = await getIndex();
    const queryEmbedding = await generateEmbedding(query);

    const results = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: { companyId },
    });

    return results.matches.map((match) => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata as VectorSearchResult['metadata'],
    }));
  } catch (error) {
    logger.error('Vector search error', error);
    throw error;
  }
}

export async function upsertVector(
  id: string,
  content: string,
  metadata: {
    documentId: string;
    companyId: string;
    title: string;
    dataType: string;
    sourceUrl?: string;
  }
) {
  try {
    const index = await getIndex();
    const embedding = await generateEmbedding(content);

    await index.upsert([
      {
        id,
        values: embedding,
        metadata: {
          ...metadata,
          content: content.substring(0, 1000), // Store preview
        },
      },
    ]);

    logger.info('Vector upserted', { id });
  } catch (error) {
    logger.error('Vector upsert error', error);
    throw error;
  }
}

export async function deleteVector(id: string) {
  try {
    const index = await getIndex();
    await index.deleteOne(id);
    logger.info('Vector deleted', { id });
  } catch (error) {
    logger.error('Vector delete error', error);
    throw error;
  }
}

export async function deleteVectorsByCompany(companyId: string) {
  try {
    const index = await getIndex();
    await index.deleteMany({ companyId });
    logger.info('Company vectors deleted', { companyId });
  } catch (error) {
    logger.error('Company vectors delete error', error);
    throw error;
  }
}
