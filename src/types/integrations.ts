import { Platform, IntegrationStatus } from "@prisma/client";

export interface IntegrationConfig {
  id: string;
  platform: Platform;
  status: IntegrationStatus;
  lastSyncAt: Date | null;
  metadata?: {
    connectedEmail?: string;
    scopes?: string[];
    stats?: {
      documentsCount?: number;
      emailsCount?: number;
      channelsCount?: number;
    };
  };
}

export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
}

export interface SyncResult {
  success: boolean;
  documentsAdded: number;
  documentsUpdated: number;
  errors: string[];
}
