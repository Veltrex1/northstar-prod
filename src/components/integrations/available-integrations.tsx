import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface AvailableIntegrationsProps {
  onConnect: (platform: string) => void;
}

const availablePlatforms = [
  { id: 'GOOGLE_WORKSPACE', name: 'Google Workspace', description: 'Drive, Docs, Gmail, Calendar' },
  { id: 'MICROSOFT_365', name: 'Microsoft 365', description: 'OneDrive, Word, Outlook, Teams' },
  { id: 'SLACK', name: 'Slack', description: 'Messages, channels, files' },
  { id: 'SALESFORCE', name: 'Salesforce', description: 'Contacts, leads, deals' },
  { id: 'QUICKBOOKS', name: 'QuickBooks', description: 'Financial data, invoices' },
];

export function AvailableIntegrations({ onConnect }: AvailableIntegrationsProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Available Integrations</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availablePlatforms.map((platform) => (
          <Card key={platform.id} className="p-6">
            <h3 className="font-semibold mb-2">{platform.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{platform.description}</p>
            <Button onClick={() => onConnect(platform.id)} className="w-full">
              Connect
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
