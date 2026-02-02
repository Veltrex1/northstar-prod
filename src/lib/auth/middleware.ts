import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/db/prisma";

export interface AuthUser {
  userId: string;
  companyId: string;
  email: string;
  name: string;
  role: string;
}

export async function authenticateRequest(
  request: NextRequest
): Promise<{ user: AuthUser } | { error: Response }> {
  try {
    const token = request.cookies.get("auth-token")?.value;

    if (!token) {
      return { error: errorResponse("UNAUTHORIZED", "Not authenticated", 401) };
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      companyId: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return { error: errorResponse("USER_NOT_FOUND", "User not found", 404) };
    }

    return {
      user: {
        userId: user.id,
        companyId: user.companyId,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  } catch (error) {
    return { error: errorResponse("AUTH_ERROR", "Authentication failed", 401) };
  }
}
