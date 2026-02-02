import { NextRequest } from "next/server";
import { successResponse } from "@/lib/utils/api-response";

export async function GET() {
  return successResponse({ status: "ok" });
}

export async function POST(request: NextRequest) {
  void request;
  return successResponse({ status: "ok" });
}
