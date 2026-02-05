import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { generateBoardReport } from '@/lib/reports/generator';
import { exportToPDF } from '@/lib/reports/exporters/pdf-exporter';
import { exportToPowerPoint } from '@/lib/reports/exporters/pptx-exporter';
import { exportToWord } from '@/lib/reports/exporters/docx-exporter';
import { prisma } from '@/lib/db/prisma';
import { MonthlyTokenLimitError } from '@/lib/ai/usage-limits';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';

const generateSchema = z.object({
  format: z.enum(['pdf', 'powerpoint', 'word', 'google_slides']),
  structure: z.enum(['standard', 'custom']),
  focusAreas: z.array(z.string()).default([]),
  customPrompt: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const { format, structure, focusAreas, customPrompt } =
      generateSchema.parse(body);

    // Get company
    const company = await prisma.company.findUnique({
      where: { id: auth.user.companyId },
    });

    if (!company) {
      return errorResponse('COMPANY_NOT_FOUND', 'Company not found', 404);
    }

    // Generate report content
    const reportContent = await generateBoardReport({
      companyId: auth.user.companyId,
      companyName: company.name,
      userId: auth.user.userId,
      format,
      structure,
      focusAreas,
      customPrompt,
    });

    // Export to requested format
    let fileBuffer: Buffer;
    let fileExtension: string;

    switch (format) {
      case 'pdf':
        fileBuffer = await exportToPDF(reportContent);
        fileExtension = 'pdf';
        break;
      case 'powerpoint':
        fileBuffer = await exportToPowerPoint(reportContent);
        fileExtension = 'pptx';
        break;
      case 'word':
        fileBuffer = await exportToWord(reportContent);
        fileExtension = 'docx';
        break;
      default:
        return errorResponse(
          'UNSUPPORTED_FORMAT',
          'Format not yet supported',
          400
        );
    }

    // Save file to public directory
    const fileName = `report-${Date.now()}.${fileExtension}`;
    const filePath = join(process.cwd(), 'public', 'reports', fileName);
    await writeFile(filePath, fileBuffer);

    // Save report to database
    const report = await prisma.boardReport.create({
      data: {
        companyId: auth.user.companyId,
        userId: auth.user.userId,
        title: reportContent.title,
        format: format.toUpperCase() as any,
        structure,
        focusAreas,
        content: reportContent,
        fileUrl: `/reports/${fileName}`,
        status: 'READY',
      },
    });

    return successResponse({
      reportId: report.id,
      fileUrl: `/reports/${fileName}`,
      title: reportContent.title,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof MonthlyTokenLimitError) {
      return errorResponse(error.code, error.message, error.status);
    }
    return errorResponse('GENERATE_ERROR', 'Failed to generate report', 500);
  }
}
