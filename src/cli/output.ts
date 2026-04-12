
export function outputSuccess(result: unknown): void {
  // Print the single JSON result to stdout for piping
  console.log(JSON.stringify(result));
}

export function formatError(err: any) {
  return {
    error: true,
    message: err?.message || String(err),
    code: err?.code || 1,
    details: err?.details,
  } as const;
}

export function outputError(err: any): never {
  const cmdErr = formatError(err);

  // Write structured JSON error to stderr
  console.error(JSON.stringify(cmdErr));

  // Optionally write stack to stderr when in debug mode
  if (process.env.DEBUG && err?.stack) {
    console.error(err.stack);
  }

  // Exit with non-zero code
  process.exit(cmdErr.code);
}
