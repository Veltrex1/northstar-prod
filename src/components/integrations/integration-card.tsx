import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Integration } from '@/hooks/use-integrations';
import { RefreshCw, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface IntegrationCardProps {
  integration: Integration;
  onSync: () => void;
  onDisconnect: () => void;
}

const platformInfo: Record<string, { name: string; color: string }> = {
  GOOGLE_WORKSPACE: { name: 'Google Workspace', color: 'bg-blue-500' },
  MICROSOFT_365: { name: 'Microsoft 365', color: 'bg-blue-600' },
  SLACK: { name: 'Slack', color: 'bg-purple-500' },
  SALESFORCE: { name: 'Salesforce', color: 'bg-blue-400' },
  QUICKBOOKS: { name: 'QuickBooks', color: 'bg-green-500' },
};

export function IntegrationCard({
  integration,
  onSync,
  onDisconnect,
}: IntegrationCardProps) {
  const info = platformInfo[integration.platform] || {
    name: integration.platform,
    color: 'bg-gray-500',
  };

  const statusIcon = {
    CONNECTED: <CheckCircle className="w-4 h-4 text-green-500" />,
    SYNCING: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
    ERROR: <XCircle className="w-4 h-4 text-red-500" />,
    DISCONNECTED: <XCircle className="w-4 h-4 text-gray-400" />,
  }[integration.status];

  const statusText = {
    CONNECTED: 'Connected',
    SYNCING: 'Syncing...',
    ERROR: 'Error',
    DISCONNECTED: 'Disconnected',
  }[integration.status];

  const lastSync = integration.lastSyncAt
    ? new Date(integration.lastSyncAt)
    : null;
  const syncText = lastSync
    ? `Last sync: ${formatRelativeTime(lastSync)}`
    : 'Never synced';

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 ${info.color} rounded-lg flex items-center justify-center`}>
            <span className="text-white font-bold text-lg">
              {info.name.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-lg">{info.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {statusIcon}
              <span className="text-sm text-gray-600">{statusText}</span>
              <span className="text-sm text-gray-400">•</span>
              <span className="text-sm text-gray-600">{syncText}</span>
            </div>
          </div>
        </div>
      </div>

      {integration.metadata?.stats && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          {integration.metadata.stats.documentsCount !== undefined && (
            <div>
              <p className="text-2xl font-bold">{integration.metadata.stats.documentsCount}</p>
              <p className="text-xs text-gray-600">Documents</p>
            </div>
          )}
          {integration.metadata.stats.emailsCount !== undefined && (
            <div>
              <p className="text-2xl font-bold">{integration.metadata.stats.emailsCount}</p>
              <p className="text-xs text-gray-600">Emails</p>
            </div>
          )}
          {integration.metadata.stats.channelsCount !== undefined && (
            <div>
              <p className="text-2xl font-bold">{integration.metadata.stats.channelsCount}</p>
              <p className="text-xs text-gray-600">Channels</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={integration.status === 'SYNCING'}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Sync Now
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDisconnect}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Disconnect
        </Button>
      </div>
    </Card>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
