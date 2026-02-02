import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        companyId: auth.user.companyId,
        userId: auth.user.userId,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        useSecondBrain: true,
      },
    });

    return successResponse({ conversations });
  } catch (error) {
    return errorResponse("FETCH_ERROR", "Failed to fetch conversations", 500);
  }
}
