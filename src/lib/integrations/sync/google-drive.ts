import { google } from 'googleapis';
import { prisma } from '@/lib/db/prisma';
import { decrypt } from '@/lib/utils/encryption';
import { getGoogleClient } from '../oauth/google';
import { logger } from '@/lib/utils/logger';

export async function syncGoogleDrive(integrationId: string) {
  try {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    const credentials = JSON.parse(decrypt(integration.credentials));
    const authClient = getGoogleClient(
      credentials.accessToken,
      credentials.refreshToken
    );

    const drive = google.drive({ version: 'v3', auth: authClient });

    const response = await drive.files.list({
      pageSize: 100,
      fields:
        'files(id, name, mimeType, createdTime, modifiedTime, webViewLink)',
      q: "trashed=false and (mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.presentation' or mimeType='application/pdf')",
    });

    const files = response.data.files || [];
    logger.info(`Found ${files.length} files in Google Drive`);

    for (const file of files) {
      await processGoogleDriveFile(
        file,
        integration.companyId,
        integration.id,
        authClient
      );
    }

    await prisma.integration.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date() },
    });

    return { success: true, filesProcessed: files.length };
  } catch (error) {
    logger.error('Google Drive sync error', error);
    throw error;
  }
}

async function processGoogleDriveFile(
  file: any,
  companyId: string,
  integrationId: string,
  authClient: any
) {
  try {
    let content = '';

    if (file.mimeType === 'application/vnd.google-apps.document') {
      const drive = google.drive({ version: 'v3', auth: authClient });
      const response = await drive.files.export({
        fileId: file.id,
        mimeType: 'text/plain',
      });
      content = response.data as string;
    }
    // Add handling for other file types (Sheets, PDFs, etc.)

    await prisma.document.upsert({
      where: {
        integrationId_externalId: {
          integrationId,
          externalId: file.id,
        },
      },
      create: {
        companyId,
        integrationId,
        externalId: file.id,
        title: file.name,
        content,
        contentType: file.mimeType,
        sourceUrl: file.webViewLink,
        metadata: {
          createdTime: file.createdTime,
          modifiedTime: file.modifiedTime,
        },
        createdAt: new Date(file.createdTime),
        updatedAt: new Date(file.modifiedTime),
      },
      update: {
        title: file.name,
        content,
        updatedAt: new Date(file.modifiedTime),
      },
    });

    logger.info(`Processed Google Drive file: ${file.name}`);
  } catch (error) {
    logger.error(`Error processing file ${file.name}`, error);
  }
}
