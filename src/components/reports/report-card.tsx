import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BoardReport } from '@/hooks/use-reports';
import { FileText, Download, Trash2 } from 'lucide-react';

interface ReportCardProps {
  report: BoardReport;
  onDelete: () => void;
}

export function ReportCard({ report, onDelete }: ReportCardProps) {
  const statusColor = {
    READY: 'bg-green-100 text-green-800',
    GENERATING: 'bg-yellow-100 text-yellow-800',
    ERROR: 'bg-red-100 text-red-800',
  }[report.status] || 'bg-gray-100 text-gray-800';

  return (
    <Card className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText className="w-6 h-6 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs uppercase">
              {report.format}
            </Badge>
            <Badge className={statusColor}>{report.status}</Badge>
          </div>
          <h3 className="font-medium truncate">{report.title}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>

        <div className="flex gap-2">
          {report.status === 'READY' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(report.fileUrl, '_blank')}
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
