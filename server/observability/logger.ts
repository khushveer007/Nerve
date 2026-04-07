function serialize(payload: Record<string, unknown>) {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({
      serialization_error: true,
      payload_type: typeof payload,
    });
  }
}

export function emitObservabilityEvent(kind: "assistant-request" | "assistant-job", payload: Record<string, unknown>) {
  console.info(`[observability:${kind}] ${serialize({
    emitted_at: new Date().toISOString(),
    ...payload,
  })}`);
}

export function emitObservabilityWriteFailure(kind: "assistant-request" | "assistant-job", error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown observability failure.";
  console.warn(`[observability:${kind}:write-failed] ${serialize({
    emitted_at: new Date().toISOString(),
    message,
  })}`);
}
