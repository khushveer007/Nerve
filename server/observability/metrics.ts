import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { config } from "../config.js";
import { pool } from "../db.js";
import {
  buildAssistantFilterSummary,
  classifyJobFailure,
  classifyProviderFailureSubtype,
  mergeFailureDescriptors,
  permissionFailure,
  providerFailure,
  retrievalFailure,
} from "./helpers.js";
import { emitObservabilityEvent, emitObservabilityWriteFailure } from "./logger.js";
import type {
  AssistantFailureDescriptor,
  AssistantLaunchSummary,
  AssistantLaunchSummaryOptions,
  AssistantJobTelemetryEvent,
  AssistantOperationalSnapshot,
  AssistantProviderMetadata,
  AssistantProviderSignal,
  AssistantRecentRequestTelemetry,
  AssistantRequestTelemetryEvent,
  AssistantStageTimings,
} from "./types.js";

function generateTelemetryId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function roundDuration(value: number) {
  return Math.max(0, Math.round(value));
}

function roundRate(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function buildLaunchSummaryScope(options: AssistantLaunchSummaryOptions = {}) {
  const params: Array<number | string[]> = [];
  const conditions: string[] = [];

  let safeHours: number | null = null;
  if (typeof options.hours === "number" && Number.isFinite(options.hours)) {
    safeHours = Math.max(1, Math.min(Math.round(options.hours), 24 * 30));
    params.push(safeHours);
    conditions.push(`created_at >= NOW() - make_interval(hours => $${params.length})`);
  }

  const requestIds = options.requestIds?.filter((requestId) => requestId.trim().length > 0) ?? [];
  if (requestIds.length > 0) {
    params.push(requestIds);
    conditions.push(`request_id = ANY($${params.length}::text[])`);
  }

  return {
    params,
    safeHours,
    requestIds: requestIds.length > 0 ? requestIds : null,
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
  };
}

function createProviderSignal(configured: boolean, model: string | null): AssistantProviderSignal {
  return {
    configured,
    attempted: false,
    status: configured ? "not_attempted" : "not_configured",
    model,
    failure_subtype: null,
  };
}

function hasRequestFailure(details: AssistantRequestTelemetryEvent) {
  return details.failureClassification !== "none"
    || details.outcome === "provider_fallback"
    || details.outcome === "permission_denied"
    || details.outcome === "request_failed";
}

function hasJobFailure(details: AssistantJobTelemetryEvent) {
  return details.failureClassification !== "none"
    || details.eventType === "retry"
    || details.eventType === "dead_letter"
    || details.eventType === "stale_lock_recovered";
}

export function createAssistantProviderMetadata(): AssistantProviderMetadata {
  return {
    embeddings: createProviderSignal(
      Boolean(config.assistant.embeddings.url),
      config.assistant.embeddings.url ? config.assistant.embeddings.model : null,
    ),
    answering: createProviderSignal(
      Boolean(config.assistant.answering.url),
      config.assistant.answering.url ? config.assistant.answering.model : null,
    ),
  };
}

export function createStageTimer() {
  const startedAt = performance.now();
  const timings: AssistantStageTimings = {};

  return {
    async measure<T>(key: string, callback: () => Promise<T> | T): Promise<T> {
      const stageStartedAt = performance.now();
      try {
        return await callback();
      } finally {
        timings[key] = roundDuration(performance.now() - stageStartedAt);
      }
    },
    snapshot(extra: AssistantStageTimings = {}) {
      return {
        ...timings,
        ...extra,
        total_ms: roundDuration(performance.now() - startedAt),
      };
    },
  };
}

export {
  buildAssistantFilterSummary,
  classifyJobFailure,
  classifyProviderFailureSubtype,
  mergeFailureDescriptors,
  permissionFailure,
  providerFailure,
  retrievalFailure,
};

export async function recordAssistantRequestTelemetry(event: AssistantRequestTelemetryEvent) {
  await pool.query(
    `INSERT INTO assistant_request_telemetry (
      id,
      request_id,
      action,
      actor_user_id,
      actor_role,
      actor_team_id,
      requested_mode,
      resolved_mode,
      authorization_outcome,
      outcome,
      failure_classification,
      failure_subtype,
      grounded,
      enough_evidence,
      no_answer,
      result_count,
      citation_count,
      filter_summary,
      stage_timings,
      provider_metadata,
      metadata
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14,
      $15,
      $16,
      $17,
      $18::jsonb,
      $19::jsonb,
      $20::jsonb,
      $21::jsonb
    )`,
    [
      generateTelemetryId("obsreq"),
      event.requestId,
      event.action,
      event.actor?.user_id ?? null,
      event.actor?.role ?? null,
      event.actor?.team_id ?? null,
      event.requestedMode,
      event.resolvedMode,
      event.authorizationOutcome,
      event.outcome,
      event.failureClassification,
      event.failureSubtype,
      event.grounded,
      event.enoughEvidence,
      event.noAnswer,
      event.resultCount,
      event.citationCount,
      JSON.stringify(event.filterSummary ?? {}),
      JSON.stringify(event.stageTimings),
      JSON.stringify(event.providerMetadata),
      JSON.stringify(event.metadata ?? {}),
    ],
  );
}

export async function safeRecordAssistantRequestTelemetry(event: AssistantRequestTelemetryEvent) {
  try {
    await recordAssistantRequestTelemetry(event);
    if (hasRequestFailure(event)) {
      emitObservabilityEvent("assistant-request", {
        request_id: event.requestId,
        action: event.action,
        outcome: event.outcome,
        failure_classification: event.failureClassification,
        failure_subtype: event.failureSubtype,
      });
    }
  } catch (error) {
    emitObservabilityWriteFailure("assistant-request", error);
  }
}

export async function recordAssistantJobTelemetry(event: AssistantJobTelemetryEvent) {
  await pool.query(
    `INSERT INTO assistant_job_telemetry (
      id,
      job_id,
      asset_id,
      asset_version_id,
      source_id,
      job_type,
      event_type,
      status,
      attempt_count,
      worker_id,
      failure_classification,
      failure_subtype,
      latency_ms,
      retry_delay_ms,
      metadata
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14,
      $15::jsonb
    )`,
    [
      generateTelemetryId("obsjob"),
      event.jobId,
      event.assetId,
      event.assetVersionId,
      event.sourceId,
      event.jobType,
      event.eventType,
      event.status,
      event.attemptCount,
      event.workerId,
      event.failureClassification,
      event.failureSubtype,
      event.latencyMs,
      event.retryDelayMs,
      JSON.stringify(event.metadata ?? {}),
    ],
  );
}

export async function safeRecordAssistantJobTelemetry(event: AssistantJobTelemetryEvent) {
  try {
    await recordAssistantJobTelemetry(event);
    if (hasJobFailure(event)) {
      emitObservabilityEvent("assistant-job", {
        job_id: event.jobId,
        event_type: event.eventType,
        failure_classification: event.failureClassification,
        failure_subtype: event.failureSubtype,
      });
    }
  } catch (error) {
    emitObservabilityWriteFailure("assistant-job", error);
  }
}

export async function listRecentAssistantRequestTelemetry(limit = 25): Promise<AssistantRecentRequestTelemetry[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const result = await pool.query<AssistantRecentRequestTelemetry>(
    `SELECT
      request_id,
      action,
      outcome,
      failure_classification,
      failure_subtype,
      requested_mode,
      resolved_mode,
      authorization_outcome,
      result_count,
      citation_count,
      grounded,
      enough_evidence,
      no_answer,
      stage_timings,
      provider_metadata,
      created_at::text
     FROM assistant_request_telemetry
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit],
  );

  return result.rows;
}

export async function getAssistantOperationalSnapshot(hours = 24): Promise<AssistantOperationalSnapshot> {
  const safeHours = Math.max(1, Math.min(Math.round(hours), 24 * 30));

  const requests = await pool.query<{
    query_events: number;
    provider_degradation_count: number;
    retrieval_failure_count: number;
    permission_failure_count: number;
    no_answer_count: number;
  }>(
    `SELECT
      COUNT(*) FILTER (WHERE action = 'query')::int AS query_events,
      COUNT(*) FILTER (WHERE failure_classification = 'provider_failure')::int AS provider_degradation_count,
      COUNT(*) FILTER (WHERE failure_classification = 'retrieval_failure')::int AS retrieval_failure_count,
      COUNT(*) FILTER (WHERE failure_classification = 'permission_failure')::int AS permission_failure_count,
      COUNT(*) FILTER (WHERE no_answer = true)::int AS no_answer_count
     FROM assistant_request_telemetry
     WHERE created_at >= NOW() - make_interval(hours => $1)`,
    [safeHours],
  );

  const operations = await pool.query<{
    queued_jobs: number;
    running_jobs: number;
    dead_letter_jobs: number;
    ready_assets: number;
    assets_needing_attention: number;
    oldest_inflight_job_age_minutes: number | null;
    max_ready_version_age_hours: number | null;
  }>(
    `SELECT
      (SELECT COUNT(*)::int FROM knowledge_jobs WHERE status = 'queued') AS queued_jobs,
      (SELECT COUNT(*)::int FROM knowledge_jobs WHERE status = 'running') AS running_jobs,
      (SELECT COUNT(*)::int FROM knowledge_jobs WHERE status = 'dead_letter') AS dead_letter_jobs,
      (SELECT COUNT(*)::int FROM knowledge_assets WHERE status = 'ready') AS ready_assets,
      (SELECT COUNT(*)::int FROM knowledge_assets WHERE status IN ('pending', 'processing', 'failed')) AS assets_needing_attention,
      (
        SELECT ROUND(MAX(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60))::int
          FROM knowledge_jobs
         WHERE status IN ('queued', 'running')
      ) AS oldest_inflight_job_age_minutes,
      (
        SELECT ROUND(MAX(EXTRACT(EPOCH FROM (NOW() - kav.created_at)) / 3600))::int
          FROM knowledge_asset_versions kav
          INNER JOIN knowledge_assets ka
            ON ka.id = kav.asset_id
         WHERE ka.status = 'ready'
           AND kav.extraction_status = 'ready'
           AND kav.superseded_at IS NULL
      ) AS max_ready_version_age_hours`,
  );

  return {
    query_events: requests.rows[0]?.query_events ?? 0,
    provider_degradation_count: requests.rows[0]?.provider_degradation_count ?? 0,
    retrieval_failure_count: requests.rows[0]?.retrieval_failure_count ?? 0,
    permission_failure_count: requests.rows[0]?.permission_failure_count ?? 0,
    no_answer_count: requests.rows[0]?.no_answer_count ?? 0,
    queued_jobs: operations.rows[0]?.queued_jobs ?? 0,
    running_jobs: operations.rows[0]?.running_jobs ?? 0,
    dead_letter_jobs: operations.rows[0]?.dead_letter_jobs ?? 0,
    ready_assets: operations.rows[0]?.ready_assets ?? 0,
    assets_needing_attention: operations.rows[0]?.assets_needing_attention ?? 0,
    oldest_inflight_job_age_minutes: operations.rows[0]?.oldest_inflight_job_age_minutes ?? 0,
    max_ready_version_age_hours: operations.rows[0]?.max_ready_version_age_hours ?? 0,
  };
}

export async function getAssistantLaunchSummary(
  options: AssistantLaunchSummaryOptions = {},
): Promise<AssistantLaunchSummary> {
  const scope = buildLaunchSummaryScope(options);

  const result = await pool.query<{
    total_request_count: number;
    query_request_count: number;
    source_preview_request_count: number;
    source_open_request_count: number;
    denied_source_request_count: number;
    search_request_count: number;
    ask_request_count: number;
    search_results_count: number;
    grounded_answer_count: number;
    grounded_answer_with_citations_count: number;
    no_answer_count: number;
    provider_fallback_count: number;
    permission_denied_count: number;
    request_failed_count: number;
    search_latency_p95_ms: number | null;
    ask_latency_p95_ms: number | null;
  }>(
    `WITH filtered AS (
      SELECT *
        FROM assistant_request_telemetry
        ${scope.whereClause}
    )
    SELECT
      COUNT(*)::int AS total_request_count,
      COUNT(*) FILTER (WHERE action = 'query')::int AS query_request_count,
      COUNT(*) FILTER (WHERE action = 'source-preview')::int AS source_preview_request_count,
      COUNT(*) FILTER (WHERE action = 'source-open')::int AS source_open_request_count,
      COUNT(*) FILTER (
        WHERE action IN ('source-preview', 'source-open')
          AND authorization_outcome = 'denied'
      )::int AS denied_source_request_count,
      COUNT(*) FILTER (WHERE action = 'query' AND resolved_mode = 'search')::int AS search_request_count,
      COUNT(*) FILTER (WHERE action = 'query' AND resolved_mode = 'ask')::int AS ask_request_count,
      COUNT(*) FILTER (WHERE action = 'query' AND outcome = 'search_results')::int AS search_results_count,
      COUNT(*) FILTER (WHERE action = 'query' AND outcome = 'grounded_answer')::int AS grounded_answer_count,
      COUNT(*) FILTER (
        WHERE action = 'query'
          AND outcome = 'grounded_answer'
          AND citation_count > 0
      )::int AS grounded_answer_with_citations_count,
      COUNT(*) FILTER (WHERE action = 'query' AND no_answer = true)::int AS no_answer_count,
      COUNT(*) FILTER (WHERE outcome = 'provider_fallback')::int AS provider_fallback_count,
      COUNT(*) FILTER (WHERE outcome = 'permission_denied')::int AS permission_denied_count,
      COUNT(*) FILTER (WHERE outcome = 'request_failed')::int AS request_failed_count,
      ROUND(
        percentile_disc(0.95) WITHIN GROUP (ORDER BY (stage_timings->>'total_ms')::numeric)
        FILTER (
          WHERE action = 'query'
            AND resolved_mode = 'search'
            AND stage_timings ? 'total_ms'
        )
      )::int AS search_latency_p95_ms,
      ROUND(
        percentile_disc(0.95) WITHIN GROUP (ORDER BY (stage_timings->>'total_ms')::numeric)
        FILTER (
          WHERE action = 'query'
            AND resolved_mode = 'ask'
            AND stage_timings ? 'total_ms'
        )
      )::int AS ask_latency_p95_ms
    FROM filtered`,
    scope.params,
  );

  const row = result.rows[0];
  const totalQueryCount = row?.query_request_count ?? 0;
  const searchRequestCount = row?.search_request_count ?? 0;
  const askRequestCount = row?.ask_request_count ?? 0;
  const groundedAnswerCount = row?.grounded_answer_count ?? 0;
  const groundedAnswerWithCitationsCount = row?.grounded_answer_with_citations_count ?? 0;
  const noAnswerCount = row?.no_answer_count ?? 0;
  const searchLatencyP95 = row?.search_latency_p95_ms ?? null;
  const askLatencyP95 = row?.ask_latency_p95_ms ?? null;

  return {
    generated_at: new Date().toISOString(),
    window_hours: scope.safeHours,
    request_ids: scope.requestIds,
    action_counts: {
      total_request_count: row?.total_request_count ?? 0,
      query_request_count: totalQueryCount,
      source_preview_request_count: row?.source_preview_request_count ?? 0,
      source_open_request_count: row?.source_open_request_count ?? 0,
      denied_source_request_count: row?.denied_source_request_count ?? 0,
    },
    request_mix: {
      total_query_count: totalQueryCount,
      search_request_count: searchRequestCount,
      ask_request_count: askRequestCount,
      search_share: totalQueryCount > 0 ? roundRate(searchRequestCount / totalQueryCount) : null,
      ask_share: totalQueryCount > 0 ? roundRate(askRequestCount / totalQueryCount) : null,
    },
    quality_metrics: {
      citation_coverage_rate: groundedAnswerCount > 0
        ? roundRate(groundedAnswerWithCitationsCount / groundedAnswerCount)
        : null,
      grounded_answer_with_citations_count: groundedAnswerWithCitationsCount,
      no_answer_rate: askRequestCount > 0 ? roundRate(noAnswerCount / askRequestCount) : null,
    },
    latency: {
      search: {
        sample_count: searchRequestCount,
        p95_ms: searchLatencyP95,
        target_ms: 2500,
        within_target: searchLatencyP95 === null ? null : searchLatencyP95 <= 2500,
      },
      ask: {
        sample_count: askRequestCount,
        p95_ms: askLatencyP95,
        target_ms: 8000,
        within_target: askLatencyP95 === null ? null : askLatencyP95 <= 8000,
      },
    },
    outcome_counts: {
      search_results_count: row?.search_results_count ?? 0,
      grounded_answer_count: groundedAnswerCount,
      no_answer_count: noAnswerCount,
      provider_fallback_count: row?.provider_fallback_count ?? 0,
      permission_denied_count: row?.permission_denied_count ?? 0,
      request_failed_count: row?.request_failed_count ?? 0,
    },
  };
}

export function defaultFailureDescriptor(): AssistantFailureDescriptor {
  return {
    classification: "none",
    subtype: null,
  };
}

export function defaultProviderMetadata(): AssistantProviderMetadata {
  return createAssistantProviderMetadata();
}
