export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const errors = {
  badRequest: (message = "Invalid request") => new ApiError(400, "bad_request", message),
  unauthenticated: () => new ApiError(401, "unauthenticated", "You must be signed in"),
  forbidden: (message = "You do not have permission to do that") => new ApiError(403, "forbidden", message),
  notFound: (message = "Not found") => new ApiError(404, "not_found", message),
  conflict: (message = "The document was changed elsewhere") => new ApiError(409, "conflict", message),
  tooLarge: (message = "Payload too large") => new ApiError(413, "too_large", message),
  unsupportedType: (message = "Unsupported file type") => new ApiError(415, "unsupported_type", message),
};

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  console.error("Unhandled error", err);
  return Response.json({ error: { code: "internal", message: "Something went wrong" } }, { status: 500 });
}

/** Wrap a handler so thrown ApiErrors become uniform JSON error responses. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    return errorResponse(err);
  }
}
