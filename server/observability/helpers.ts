import type { AssistantQueryFilters } from "../rag/types.js";
import type {
  AssistantFailureDescriptor,
  AssistantFilterSummary,
} from "./types.js";

export function buildAssistantFilterSummary(filters: AssistantQueryFilters): AssistantFilterSummary {
  return {
    department: filters.department,
    sort: filters.sort,
    has_date_start: Boolean(filters.date_range.start),
    has_date_end: Boolean(filters.date_range.end),
  };
}

export function providerFailure(subtype: string | null): AssistantFailureDescriptor {
  return {
    classification: "provider_failure",
    subtype,
  };
}

export function retrievalFailure(subtype: string | null): AssistantFailureDescriptor {
  return {
    classification: "retrieval_failure",
    subtype,
  };
}

export function permissionFailure(subtype: string | null): AssistantFailureDescriptor {
  return {
    classification: "permission_failure",
    subtype,
  };
}

export function mergeFailureDescriptors(
  current: AssistantFailureDescriptor,
  next: AssistantFailureDescriptor,
): AssistantFailureDescriptor {
  if (current.classification === "none") {
    return next;
  }

  return current;
}

export function classifyProviderFailureSubtype(scope: "embedding" | "answering", error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown provider failure.";
  const normalized = message.toLowerCase();

  if (normalized.includes("timed out")) {
    return `${scope}_timeout`;
  }

  if (normalized.includes("status")) {
    return `${scope}_http_error`;
  }

  if (normalized.includes("payload") || normalized.includes("schema") || normalized.includes("json")) {
    return `${scope}_invalid_payload`;
  }

  return `${scope}_transport_error`;
}

export function classifyJobFailure(error: unknown): AssistantFailureDescriptor {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("embedding request") || message.includes("embedding response")) {
    return providerFailure(classifyProviderFailureSubtype("embedding", error));
  }

  if (message.includes("answer request") || message.includes("answer provider")) {
    return providerFailure(classifyProviderFailureSubtype("answering", error));
  }

  return retrievalFailure("job_processing_failure");
}
