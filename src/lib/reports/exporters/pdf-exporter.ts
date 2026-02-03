import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { ReportContent } from '../generator';
import { logger } from '@/lib/utils/logger';

export async function exportToPDF(report: ReportContent): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add title page
    let page = pdfDoc.addPage([612, 792]); // Letter size
    const { height } = page.getSize();

    page.drawText(report.title, {
      x: 50,
      y: height - 100,
      size: 24,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Generated: ${report.metadata.generatedAt.toLocaleDateString()}`, {
      x: 50,
      y: height - 130,
      size: 12,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    let yPosition = height - 180;

    // Add sections
    for (const section of report.sections) {
      // Check if we need a new page
      if (yPosition < 100) {
        page = pdfDoc.addPage([612, 792]);
        yPosition = height - 50;
      }

      // Section title
      page.drawText(section.title, {
        x: 50,
        y: yPosition,
        size: 18,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPosition -= 30;

      // Section content
      const lines = wrapText(section.content, 500, font, 11);
      for (const line of lines) {
        if (yPosition < 50) {
          page = pdfDoc.addPage([612, 792]);
          yPosition = height - 50;
        }

        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: 11,
          font,
          color: rgb(0, 0, 0),
          maxWidth: 500,
        });

        yPosition -= 15;
      }

      yPosition -= 20; // Space between sections
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    logger.error('PDF export error', error);
    throw error;
  }
}

function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
