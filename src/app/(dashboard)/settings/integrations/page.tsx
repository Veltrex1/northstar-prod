'use client';

import { useIntegrations } from '@/hooks/use-integrations';
import { IntegrationCard } from '@/components/integrations/integration-card';
import { AvailableIntegrations } from '@/components/integrations/available-integrations';
import { Skeleton } from '@/components/ui/skeleton';

export default function IntegrationsPage() {
  const {
    integrations,
    isLoading,
    connectIntegration,
    syncIntegration,
    disconnectIntegration,
  } = useIntegrations();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const connectedIntegrations = integrations.filter((i) => i.status !== 'DISCONNECTED');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Integrations</h1>
        <p className="text-gray-600">
          Connect your data sources to power Northstar's Second Brain
        </p>
      </div>

      {connectedIntegrations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Connected</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connectedIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onSync={() => syncIntegration(integration.id)}
                onDisconnect={() => disconnectIntegration(integration.id)}
              />
            ))}
          </div>
        </div>
      )}

      <AvailableIntegrations onConnect={connectIntegration} />
    </div>
  );
}
