import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
} from 'docx';
import { ReportContent } from '../generator';
import { logger } from '@/lib/utils/logger';

export async function exportToWord(report: ReportContent): Promise<Buffer> {
  try {
    const sections = [
      // Title page
      new Paragraph({
        text: report.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      new Paragraph({
        text: `Generated: ${report.metadata.generatedAt.toLocaleDateString()}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 },
      }),
    ];

    // Content sections
    for (const section of report.sections) {
      // Section heading
      sections.push(
        new Paragraph({
          text: section.title,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      if (section.type === 'table' && section.tableData) {
        // Add table
        const tableRows = [
          new TableRow({
            children: section.tableData.headers.map(
              (header: string) =>
                new TableCell({
                  children: [new Paragraph({ text: header, bold: true })],
                })
            ),
          }),
          ...section.tableData.rows.map(
            (row: string[]) =>
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      children: [new Paragraph({ text: cell })],
                    })
                ),
              })
          ),
        ];

        sections.push(
          new Paragraph({ text: '' }),
          new Table({ rows: tableRows }),
          new Paragraph({ text: '' })
        );
      } else {
        // Add text content
        const paragraphs = section.content.split('\n\n');
        for (const para of paragraphs) {
          sections.push(
            new Paragraph({
              text: para,
              spacing: { after: 200 },
            })
          );
        }
      }
    }

    const doc = new Document({
      sections: [{ children: sections }],
    });

    const buffer = await Packer.toBuffer(doc);
    return buffer;
  } catch (error) {
    logger.error('Word export error', error);
    throw error;
  }
}
