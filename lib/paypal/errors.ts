// PayPal SDK errors carry the request headers, including our credentials.
// Log only the safe parts.
export function safePayPalError(error: unknown) {
  const e = error as {
    statusCode?: number;
    result?: { name?: string; error?: string; message?: string; debug_id?: string };
    message?: string;
  };
  return {
    status: e?.statusCode,
    name: e?.result?.name ?? e?.result?.error,
    message: e?.result?.message ?? e?.message,
    debugId: e?.result?.debug_id,
  };
}
