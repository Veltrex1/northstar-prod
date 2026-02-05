import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import {
  getMicrosoftAccessTokenFromIntegration,
} from '@/lib/integrations/microsoft/credentials';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
export async function syncMicrosoft365(integrationId: string) {
  try {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    const { accessToken } = await getMicrosoftAccessTokenFromIntegration(
      integration
    );

    const response = await fetch(
      `${GRAPH_BASE_URL}/me/drive/root/children?$top=10`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Microsoft Graph sync failed: ${errorText}`);
    }

    const data = (await response.json()) as { value?: Array<{ id: string }> };
    const files = data.value || [];

    await prisma.integration.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date() },
    });

    logger.info(`Microsoft 365 sync fetched ${files.length} files`, {
      integrationId,
    });

    return { success: true, filesFetched: files.length };
  } catch (error) {
    logger.error('Microsoft 365 sync error', error);
    throw error;
  }
}
