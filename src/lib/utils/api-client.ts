type ApiError = {
  code: string;
  message: string;
  status?: number;
  body?: string;
};

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

export async function parseApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const body = await response.text();
    return {
      success: false,
      error: {
        code: "NON_JSON_RESPONSE",
        message: "Expected JSON response",
        status: response.status,
        body,
      },
    };
  }

  return response.json() as Promise<ApiResponse<T>>;
}
