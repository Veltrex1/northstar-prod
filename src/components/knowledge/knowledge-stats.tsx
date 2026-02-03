import { Card } from '@/components/ui/card';

interface KnowledgeStatsProps {
  totalDocuments: number;
  byType: Record<string, number>;
  byIntegration: Record<string, number>;
}

export function KnowledgeStats({
  totalDocuments,
  byType,
  byIntegration,
}: KnowledgeStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="p-6">
        <p className="text-sm text-gray-600 mb-1">Total Documents</p>
        <p className="text-3xl font-bold">{totalDocuments}</p>
      </Card>

      <Card className="p-6">
        <p className="text-sm text-gray-600 mb-3">By Type</p>
        <div className="space-y-2">
          {Object.entries(byType).map(([type, count]) => (
            <div key={type} className="flex justify-between text-sm">
              <span className="text-gray-700 capitalize">{type}</span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <p className="text-sm text-gray-600 mb-3">By Source</p>
        <div className="space-y-2">
          {Object.entries(byIntegration).map(([integration, count]) => (
            <div key={integration} className="flex justify-between text-sm">
              <span className="text-gray-700">{integration}</span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
export default function Component() {
  return null;
}
