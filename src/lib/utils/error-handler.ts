import { NextResponse } from "next/server";
import { errorResponse } from "./api-response";

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error("API Error:", error);

  if (error instanceof AppError) {
    return errorResponse(error.code, error.message, error.statusCode);
  }

  if (error instanceof Error) {
    return errorResponse("INTERNAL_ERROR", error.message, 500);
  }

  return errorResponse("UNKNOWN_ERROR", "An unknown error occurred", 500);
}
