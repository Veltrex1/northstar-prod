import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
    });

    if (!conversation) {
      return errorResponse("NOT_FOUND", "Conversation not found", 404);
    }

    if (conversation.userId !== auth.user.userId) {
      return errorResponse("FORBIDDEN", "Access denied", 403);
    }

    return successResponse({ conversation });
  } catch (error) {
    return errorResponse("FETCH_ERROR", "Failed to fetch conversation", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
    });

    if (!conversation) {
      return errorResponse("NOT_FOUND", "Conversation not found", 404);
    }

    if (conversation.userId !== auth.user.userId) {
      return errorResponse("FORBIDDEN", "Access denied", 403);
    }

    await prisma.conversation.delete({
      where: { id: params.id },
    });

    return successResponse({ message: "Conversation deleted" });
  } catch (error) {
    return errorResponse("DELETE_ERROR", "Failed to delete conversation", 500);
  }
}
