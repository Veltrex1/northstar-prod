export interface ReportSection {
  title: string;
  type: 'text' | 'chart' | 'table';
  dataQuery?: string;
  visualizationType?: 'line' | 'bar' | 'pie' | 'area';
}

export const STANDARD_BOARD_REPORT: ReportSection[] = [
  {
    title: 'Executive Summary',
    type: 'text',
    dataQuery:
      'Provide a high-level overview of company performance, key achievements, and critical metrics for the reporting period.',
  },
  {
    title: 'Financial Performance',
    type: 'chart',
    dataQuery: 'Revenue, profit, burn rate, and runway data',
    visualizationType: 'line',
  },
  {
    title: 'Financial Metrics Table',
    type: 'table',
    dataQuery:
      'Key financial metrics: Revenue, EBITDA, Profit/Loss, Cash Position, Burn Rate, Runway',
  },
  {
    title: 'Operational Metrics',
    type: 'text',
    dataQuery:
      'Headcount, customer acquisition cost (CAC), lifetime value (LTV), churn rate, and other operational KPIs',
  },
  {
    title: 'Strategic Initiatives',
    type: 'text',
    dataQuery:
      'Progress on key strategic goals, OKRs, product launches, and major initiatives',
  },
  {
    title: 'Market Position',
    type: 'text',
    dataQuery:
      'Competitive landscape, market share, customer feedback, and positioning',
  },
  {
    title: 'Risks & Mitigation',
    type: 'text',
    dataQuery: 'Key risks facing the business and mitigation strategies',
  },
  {
    title: 'Next Quarter Outlook',
    type: 'text',
    dataQuery: 'Goals, initiatives, and projections for the next quarter',
  },
];

export function getReportTemplate(type: 'standard' | 'custom'): ReportSection[] {
  if (type === 'standard') {
    return STANDARD_BOARD_REPORT;
  }
  return [];
}
