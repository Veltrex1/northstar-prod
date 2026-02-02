import { NextRequest } from "next/server";
import { successResponse } from "@/lib/utils/api-response";

export async function POST(request: NextRequest) {
  void request;
  const response = successResponse({ message: "Logged out successfully" });

  response.cookies.delete("auth-token");

  return response;
}
