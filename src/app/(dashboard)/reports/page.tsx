'use client';

import { useState } from 'react';
import { useReports } from '@/hooks/use-reports';
import { ReportWizard } from '@/components/reports/report-wizard';
import { ReportCard } from '@/components/reports/report-card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, FileText } from 'lucide-react';

export default function ReportsPage() {
  const { reports, isLoading, generateReport, deleteReport } = useReports();
  const [activeTab, setActiveTab] = useState('all');

  const handleGenerate = async (params: any) => {
    const result = await generateReport(params);
    if (result) {
      setActiveTab('all');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Board Reports</h1>
          <p className="text-gray-600">AI-generated reports from your data</p>
        </div>
        <Button onClick={() => setActiveTab('new')}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Generate Report
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Reports</TabsTrigger>
          <TabsTrigger value="new">Generate New</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No reports yet</h3>
              <p className="text-gray-600 mb-6">
                Generate your first board report to get started
              </p>
              <Button onClick={() => setActiveTab('new')}>
                <PlusCircle className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onDelete={() => deleteReport(report.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="new" className="mt-6">
          <div className="max-w-2xl mx-auto">
            <ReportWizard onGenerate={handleGenerate} isLoading={isLoading} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
