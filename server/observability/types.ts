import type {
  AssistantActorContext,
  AssistantQueryFilters,
  AssistantQueryMode,
  AssistantResolvedMode,
} from "../rag/types.js";

export type AssistantTelemetryAction = "query" | "source-preview" | "source-open";
export type AssistantTelemetryAuthorizationOutcome = "allowed" | "denied";
export type AssistantTelemetryOutcome =
  | "search_results"
  | "grounded_answer"
  | "no_answer"
  | "provider_fallback"
  | "permission_denied"
  | "preview_served"
  | "source_opened"
  | "request_failed";
export type AssistantTelemetryFailureClassification =
  | "none"
  | "retrieval_failure"
  | "permission_failure"
  | "provider_failure";
export type AssistantProviderState = "not_configured" | "not_attempted" | "succeeded" | "degraded";
export type AssistantJobTelemetryEventType =
  | "enqueue"
  | "claimed"
  | "stale_lock_recovered"
  | "succeeded"
  | "retry"
  | "dead_letter";

export interface AssistantFailureDescriptor {
  classification: AssistantTelemetryFailureClassification;
  subtype: string | null;
}

export interface AssistantProviderSignal {
  configured: boolean;
  attempted: boolean;
  status: AssistantProviderState;
  model: string | null;
  failure_subtype: string | null;
}

export interface AssistantProviderMetadata {
  embeddings: AssistantProviderSignal;
  answering: AssistantProviderSignal;
}

export type AssistantStageTimings = Record<string, number>;

export interface AssistantFilterSummary {
  department: string | null;
  sort: AssistantQueryFilters["sort"];
  has_date_start: boolean;
  has_date_end: boolean;
}

export interface AssistantRequestTelemetryEvent {
  requestId: string;
  action: AssistantTelemetryAction;
  actor: AssistantActorContext | null;
  requestedMode: AssistantQueryMode | null;
  resolvedMode: AssistantResolvedMode | null;
  authorizationOutcome: AssistantTelemetryAuthorizationOutcome;
  outcome: AssistantTelemetryOutcome;
  failureClassification: AssistantTelemetryFailureClassification;
  failureSubtype: string | null;
  grounded: boolean;
  enoughEvidence: boolean;
  noAnswer: boolean;
  resultCount: number;
  citationCount: number;
  filterSummary: AssistantFilterSummary | null;
  stageTimings: AssistantStageTimings;
  providerMetadata: AssistantProviderMetadata;
  metadata?: Record<string, unknown>;
}

export interface AssistantJobTelemetryEvent {
  jobId: string | null;
  assetId: string | null;
  assetVersionId: string | null;
  sourceId: string | null;
  jobType: string | null;
  eventType: AssistantJobTelemetryEventType;
  status: string | null;
  attemptCount: number;
  workerId: string | null;
  failureClassification: AssistantTelemetryFailureClassification;
  failureSubtype: string | null;
  latencyMs: number | null;
  retryDelayMs: number | null;
  metadata?: Record<string, unknown>;
}

export interface AssistantRecentRequestTelemetry {
  request_id: string;
  action: AssistantTelemetryAction;
  outcome: AssistantTelemetryOutcome;
  failure_classification: AssistantTelemetryFailureClassification;
  failure_subtype: string | null;
  requested_mode: AssistantQueryMode | null;
  resolved_mode: AssistantResolvedMode | null;
  authorization_outcome: AssistantTelemetryAuthorizationOutcome;
  result_count: number;
  citation_count: number;
  grounded: boolean;
  enough_evidence: boolean;
  no_answer: boolean;
  stage_timings: AssistantStageTimings;
  provider_metadata: AssistantProviderMetadata;
  created_at: string;
}

export interface AssistantOperationalSnapshot {
  query_events: number;
  provider_degradation_count: number;
  retrieval_failure_count: number;
  permission_failure_count: number;
  no_answer_count: number;
  queued_jobs: number;
  running_jobs: number;
  dead_letter_jobs: number;
  ready_assets: number;
  assets_needing_attention: number;
  oldest_inflight_job_age_minutes: number;
  max_ready_version_age_hours: number;
}
