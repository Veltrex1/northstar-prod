import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

export async function GET(request: NextRequest) {
  void request;

  try {
    await prisma.$connect();

    const companiesCount = await prisma.company.count();
    const usersCount = await prisma.user.count();

    return successResponse({
      message: "Database connected successfully",
      stats: {
        companies: companiesCount,
        users: usersCount,
      },
    });
  } catch (error) {
    void error;
    return errorResponse("DB_ERROR", "Failed to connect to database", 500);
  }
}
