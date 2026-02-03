import PptxGenJs from 'pptxgenjs';
import { ReportContent } from '../generator';
import { logger } from '@/lib/utils/logger';

export async function exportToPowerPoint(report: ReportContent): Promise<Buffer> {
  try {
    const pptx = new PptxGenJs();

    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.addText(report.title, {
      x: 0.5,
      y: 2,
      w: 9,
      h: 1,
      fontSize: 32,
      bold: true,
      color: '363636',
      align: 'center',
    });

    titleSlide.addText(
      `Generated: ${report.metadata.generatedAt.toLocaleDateString()}`,
      {
        x: 0.5,
        y: 3.5,
        w: 9,
        h: 0.5,
        fontSize: 14,
        color: '666666',
        align: 'center',
      }
    );

    // Content slides
    for (const section of report.sections) {
      const slide = pptx.addSlide();

      // Section title
      slide.addText(section.title, {
        x: 0.5,
        y: 0.5,
        w: 9,
        h: 0.75,
        fontSize: 24,
        bold: true,
        color: '363636',
      });

      if (section.type === 'chart' && section.chartData) {
        // Add chart
        slide.addChart(pptx.ChartType.line, section.chartData.datasets, {
          x: 1,
          y: 1.5,
          w: 8,
          h: 4,
          chartColors: ['0088CC', 'FF6B6B', '4ECDC4'],
          title: section.title,
        });
      } else if (section.type === 'table' && section.tableData) {
        // Add table
        const rows = [section.tableData.headers, ...section.tableData.rows];

        slide.addTable(rows, {
          x: 0.5,
          y: 1.5,
          w: 9,
          h: 4,
          colW: [3, 3, 3],
          fontSize: 12,
        });
      } else {
        // Add text content
        slide.addText(section.content, {
          x: 0.5,
          y: 1.5,
          w: 9,
          h: 4.5,
          fontSize: 14,
          color: '363636',
          valign: 'top',
        });
      }
    }

    // Generate buffer
    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    return buffer as Buffer;
  } catch (error) {
    logger.error('PowerPoint export error', error);
    throw error;
  }
}
