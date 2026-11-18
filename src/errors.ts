// D1 free-plan exhaustion and sibling resource failures surface as a thrown
// D1 error. Answer with a clear, honest "busy" instead of a bare internal
// error; the client translates this string for Arabic pages.
export const BUSY_ERROR =
  "The service is busy right now. Please try again shortly.";
export function isBusyError(err: unknown): boolean {
  const e = err as Error & { cause?: Error };
  const text = `${e?.message || ""} ${e?.cause?.message || ""}`;
  return /D1_ERROR|rows read|rows written|exceeded maximum|too many rows/i.test(
    text,
  );
}
