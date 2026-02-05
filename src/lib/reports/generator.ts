import { chatCompletion } from '@/lib/ai/claude-client';
import { retrieveKnowledge } from '@/lib/ai/knowledge-retrieval';
import {
  STANDARD_BOARD_REPORT,
  ReportSection,
} from './templates/standard-board-report';
import { logger } from '@/lib/utils/logger';
import {
  assertWithinMonthlyOutputTokenCap,
  recordOutputTokens,
} from '@/lib/ai/usage-limits';

export interface ReportRequest {
  companyId: string;
  companyName: string;
  userId: string;
  format: 'pdf' | 'powerpoint' | 'word' | 'google_slides';
  structure: 'standard' | 'custom';
  focusAreas: string[];
  customPrompt?: string;
}

export interface ReportContent {
  title: string;
  sections: Array<{
    title: string;
    content: string;
    type: 'text' | 'chart' | 'table';
    chartData?: any;
    tableData?: any;
  }>;
  metadata: {
    generatedAt: Date;
    focusAreas: string[];
    sources: string[];
  };
}

export async function generateBoardReport(
  request: ReportRequest
): Promise<ReportContent> {
  try {
    logger.info('Generating board report', { companyName: request.companyName });

    const template =
      request.structure === 'standard'
        ? STANDARD_BOARD_REPORT
        : await buildCustomTemplate(request.customPrompt || '', request.userId);

    const sections = await generateSections(
      template,
      request.companyId,
      request.companyName,
      request.focusAreas,
      request.userId
    );

    return {
      title: `${request.companyName} Board Report - ${new Date().toLocaleDateString()}`,
      sections,
      metadata: {
        generatedAt: new Date(),
        focusAreas: request.focusAreas,
        sources: sections.flatMap((s) => s.sources || []),
      },
    };
  } catch (error) {
    logger.error('Report generation error', error);
    throw error;
  }
}

async function generateSections(
  template: ReportSection[],
  companyId: string,
  companyName: string,
  focusAreas: string[],
  userId: string
): Promise<
  Array<{
    title: string;
    content: string;
    type: 'text' | 'chart' | 'table';
    chartData?: any;
    tableData?: any;
    sources?: string[];
  }>
> {
  const sections = [];

  for (const section of template) {
    logger.info(`Generating section: ${section.title}`);

    // Skip sections not in focus areas (if specified)
    if (focusAreas.length > 0) {
      const isInFocus = focusAreas.some((area) =>
        section.title.toLowerCase().includes(area.toLowerCase())
      );
      if (!isInFocus && section.title !== 'Executive Summary') {
        continue;
      }
    }

    // Retrieve relevant knowledge
    const knowledge = await retrieveKnowledge(
      section.dataQuery || section.title,
      companyId,
      10
    );

    // Generate content
    const content = await generateSectionContent(
      section,
      companyName,
      knowledge.results,
      userId
    );

    sections.push({
      title: section.title,
      content: content.text,
      type: section.type,
      chartData: content.chartData,
      tableData: content.tableData,
      sources: knowledge.results.map((r) => r.title),
    });
  }

  return sections;
}

async function generateSectionContent(
  section: ReportSection,
  companyName: string,
  knowledgeResults: any[],
  userId: string
): Promise<{
  text: string;
  chartData?: any;
  tableData?: any;
}> {
  const knowledgeContext = knowledgeResults
    .map((result) => `Source: ${result.title}\n${result.content}`)
    .join('\n\n---\n\n');

  const prompt = `You are generating the "${section.title}" section for ${companyName}'s board report.

Knowledge from company documents:
${knowledgeContext}

Requirements:
- Write a comprehensive ${section.type === 'text' ? 'narrative' : 'summary'}
- Use specific numbers and metrics from the knowledge base
- Be factual and data-driven
- ${section.type === 'chart' ? 'Include data that can be visualized in a chart' : ''}
- ${section.type === 'table' ? 'Present data in a clear tabular format' : ''}
- Professional tone suitable for board presentation

${section.dataQuery ? `Focus on: ${section.dataQuery}` : ''}

${
  section.type === 'chart'
    ? `Also provide chart data in this JSON format:
{
  "labels": ["Jan", "Feb", "Mar"],
  "datasets": [
    {
      "label": "Revenue",
      "data": [100, 150, 200]
    }
  ]
}`
    : ''
}

${
  section.type === 'table'
    ? `Also provide table data in this JSON format:
{
  "headers": ["Metric", "Q3 2024", "Q4 2024"],
  "rows": [
    ["Revenue", "$1.2M", "$1.5M"],
    ["Profit", "$200K", "$300K"]
  ]
}`
    : ''
}`;

  await assertWithinMonthlyOutputTokenCap(userId, 2048);
  const response = await chatCompletion(
    [{ role: 'user', content: prompt }],
    'You are an expert board report writer. Be concise, data-driven, and professional.',
    2048
  );
  await recordOutputTokens(userId, response.outputTokens);

  // Extract chart/table data if present
  let chartData, tableData;

  if (section.type === 'chart' || section.type === 'table') {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[0]);
        if (section.type === 'chart') {
          chartData = data;
        } else {
          tableData = data;
        }
      } catch (e) {
        logger.warn('Failed to parse chart/table data', e);
      }
    }
  }

  // Extract text content (remove JSON)
  const text = response.text.replace(/\{[\s\S]*\}/, '').trim();

  return { text, chartData, tableData };
}

async function buildCustomTemplate(
  prompt: string,
  userId: string
): Promise<ReportSection[]> {
  const systemPrompt = `Create a board report template based on the user's requirements. 
  Provide a JSON array of sections with title, type (text/chart/table), and dataQuery fields.`;

  await assertWithinMonthlyOutputTokenCap(userId, 2048);
  const response = await chatCompletion(
    [
      {
        role: 'user',
        content: `Create a report template for: ${prompt}`,
      },
    ],
    systemPrompt
  );
  await recordOutputTokens(userId, response.outputTokens);

  const jsonMatch = response.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse custom template');
  }

  return JSON.parse(jsonMatch[0]);
}
