/**
 * Extract a user-facing error message from an API error response.
 * Works with Axios-style error shapes: `error.response.data.error`.
 */
export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error
  ) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (typeof response?.data?.error === 'string') {
      return response.data.error;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
