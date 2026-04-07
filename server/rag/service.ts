import { randomUUID } from "node:crypto";
import {
  buildAssistantFilterSummary,
  classifyProviderFailureSubtype,
  createStageTimer,
  defaultFailureDescriptor,
  defaultProviderMetadata,
  mergeFailureDescriptors,
  permissionFailure,
  providerFailure,
  retrievalFailure,
  safeRecordAssistantRequestTelemetry,
} from "../observability/metrics.js";
import { config } from "../config.js";
import { buildAssistantSourceOpenPath } from "./acl.js";
import {
  answerGenerationEnabled,
  assessGroundedAnswerEvidence,
  buildAskFollowUpSuggestions,
  generateGroundedAnswer,
} from "./answering.js";
import { embeddingsEnabled, embedQueryText } from "./embeddings.js";
import {
  getAssistantHealthSnapshot,
  getAuthorizedAssistantEntrySource,
  searchEntryKnowledge,
} from "./db.js";
import { resolveAssistantMode } from "./intent.js";
import type {
  AssistantActorContext,
  AssistantHealthResponse,
  AssistantQueryInput,
  AssistantQueryResult,
  AssistantResolvedMode,
  AssistantSourceOpenResult,
  AssistantSourcePreviewResult,
  AssistantSourceReference,
} from "./types.js";

export class AssistantAuthorizationError extends Error {}

export async function getAssistantHealth(): Promise<AssistantHealthResponse> {
  if (!config.assistant.enabled) {
    return {
      available: false,
      title: "Assistant search is disabled in this environment.",
      description: "Enable the assistant backend settings to expose the entry-backed query service.",
      nextStep: "Set the assistant feature flags and restart the API plus worker services.",
    };
  }

  const snapshot = await getAssistantHealthSnapshot();
  if (snapshot.ready_assets > 0) {
    return {
      available: true,
      title: "Assistant is available.",
      description: `Entry-backed search is live with ${snapshot.ready_assets} indexed knowledge asset${snapshot.ready_assets === 1 ? "" : "s"}.`,
      nextStep: "Submit a query to search the Phase 1 entry corpus.",
    };
  }

  return {
    available: true,
    title: "Assistant is preparing the entry corpus.",
    description: snapshot.queued_jobs > 0 || snapshot.running_jobs > 0
      ? "The backend is healthy and the initial entry backfill is still running."
      : "The backend is healthy, but the entry corpus has not been indexed yet.",
    nextStep: "Start the worker or wait for queued jobs to finish before validating search results.",
  };
}

function buildSourceReference(result: AssistantQueryResult["results"][number]): AssistantSourceReference {
  return {
    asset_id: result.asset_id,
    asset_version_id: result.asset_version_id,
    chunk_id: result.chunk_id,
    entry_id: result.entry_id,
    source_kind: "entry",
  };
}

async function loadGroundedAnswerEvidence(
  actor: AssistantActorContext,
  results: AssistantQueryResult["results"],
) {
  const selectedResults = results.slice(0, 3);
  const previews = await Promise.all(selectedResults.map(async (result, index) => {
    const preview = await getAuthorizedAssistantEntrySource({
      actor,
      source: buildSourceReference(result),
    });

    if (!preview) {
      return null;
    }

    return {
      label: `S${index + 1}`,
      result,
      excerpt: preview.excerpt,
    };
  }));

  return previews.filter((item): item is NonNullable<typeof item> => item !== null);
}

function buildSourceTelemetryMetadata(source: AssistantSourceReference) {
  return {
    source_kind: source.source_kind,
    asset_id: source.asset_id,
    asset_version_id: source.asset_version_id,
    chunk_id: source.chunk_id,
    entry_id: source.entry_id,
  };
}

export async function executeAssistantQuery(
  actor: AssistantActorContext,
  input: AssistantQueryInput,
): Promise<AssistantQueryResult> {
  const requestId = randomUUID();
  const timer = createStageTimer();
  const providerMetadata = defaultProviderMetadata();
  const filterSummary = buildAssistantFilterSummary(input.filters);
  let failureDescriptor = defaultFailureDescriptor();
  let resolvedMode: AssistantResolvedMode | null = null;

  try {
    const resolution = await timer.measure("mode_resolution_ms", async () => resolveAssistantMode(input));
    resolvedMode = resolution.mode;

    let queryEmbedding: string | null = null;
    if (embeddingsEnabled()) {
      providerMetadata.embeddings.attempted = true;
      try {
        queryEmbedding = await timer.measure("embeddings_ms", async () => embedQueryText(input.text));
        providerMetadata.embeddings.status = "succeeded";
      } catch (error) {
        const failureSubtype = classifyProviderFailureSubtype("embedding", error);
        providerMetadata.embeddings.status = "degraded";
        providerMetadata.embeddings.failure_subtype = failureSubtype;
        failureDescriptor = mergeFailureDescriptors(failureDescriptor, providerFailure(failureSubtype));
      }
    }

    const search = await timer.measure("retrieval_ms", async () => searchEntryKnowledge({
      actor,
      queryText: input.text,
      queryEmbedding,
      queryEmbeddingMaxDistance: config.assistant.embeddings.maxQueryDistance,
      filters: input.filters,
      limit: config.assistant.queryResultLimit,
    }));

    if (resolvedMode === "search") {
      const result = {
        mode: resolvedMode,
        answer: null,
        enough_evidence: search.totalCount > 0,
        grounded: false,
        citations: [],
        applied_filters: input.filters,
        total_results: search.totalCount,
        results: search.results,
        follow_up_suggestions: buildAskFollowUpSuggestions(
          search.totalCount === 0 ? "no_results" : "search",
          search.totalCount,
        ),
        request_id: requestId,
      } satisfies AssistantQueryResult;

      await safeRecordAssistantRequestTelemetry({
        requestId,
        action: "query",
        actor,
        requestedMode: input.mode,
        resolvedMode,
        authorizationOutcome: "allowed",
        outcome: "search_results",
        failureClassification: failureDescriptor.classification,
        failureSubtype: failureDescriptor.subtype,
        grounded: false,
        enoughEvidence: result.enough_evidence,
        noAnswer: false,
        resultCount: search.totalCount,
        citationCount: 0,
        filterSummary,
        stageTimings: timer.snapshot(),
        providerMetadata,
        metadata: {
          returned_result_count: result.results.length,
          zero_results: search.totalCount === 0,
        },
      });

      return result;
    }

    const assessment = await timer.measure("evidence_assessment_ms", async () => {
      const answerEvidence = await loadGroundedAnswerEvidence(actor, search.results);
      return assessGroundedAnswerEvidence(input.text, answerEvidence);
    });

    if (!assessment.enoughEvidence) {
      const result = {
        mode: resolvedMode,
        answer: null,
        enough_evidence: false,
        grounded: false,
        citations: [],
        applied_filters: input.filters,
        total_results: search.totalCount,
        results: search.results,
        follow_up_suggestions: buildAskFollowUpSuggestions(
          assessment.reason === "sufficient" ? "weak_evidence" : assessment.reason,
          search.totalCount,
        ),
        request_id: requestId,
      } satisfies AssistantQueryResult;

      await safeRecordAssistantRequestTelemetry({
        requestId,
        action: "query",
        actor,
        requestedMode: input.mode,
        resolvedMode,
        authorizationOutcome: "allowed",
        outcome: "no_answer",
        failureClassification: failureDescriptor.classification,
        failureSubtype: failureDescriptor.subtype,
        grounded: false,
        enoughEvidence: false,
        noAnswer: true,
        resultCount: search.totalCount,
        citationCount: 0,
        filterSummary,
        stageTimings: timer.snapshot(),
        providerMetadata,
        metadata: {
          assessment_reason: assessment.reason,
          returned_result_count: result.results.length,
        },
      });

      return result;
    }

    if (!answerGenerationEnabled()) {
      const answerFailure = providerFailure("answer_provider_unavailable");
      providerMetadata.answering.failure_subtype = answerFailure.subtype;

      const result = {
        mode: resolvedMode,
        answer: null,
        enough_evidence: true,
        grounded: false,
        citations: [],
        applied_filters: input.filters,
        total_results: search.totalCount,
        results: search.results,
        follow_up_suggestions: buildAskFollowUpSuggestions("answer_service_unavailable", search.totalCount),
        request_id: requestId,
      } satisfies AssistantQueryResult;

      await safeRecordAssistantRequestTelemetry({
        requestId,
        action: "query",
        actor,
        requestedMode: input.mode,
        resolvedMode,
        authorizationOutcome: "allowed",
        outcome: "provider_fallback",
        failureClassification: answerFailure.classification,
        failureSubtype: answerFailure.subtype,
        grounded: false,
        enoughEvidence: true,
        noAnswer: false,
        resultCount: search.totalCount,
        citationCount: 0,
        filterSummary,
        stageTimings: timer.snapshot(),
        providerMetadata,
        metadata: {
          returned_result_count: result.results.length,
        },
      });

      return result;
    }

    providerMetadata.answering.attempted = true;

    try {
      const groundedAnswer = await timer.measure("answer_generation_ms", async () => (
        generateGroundedAnswer(input.text, assessment.evidence)
      ));
      providerMetadata.answering.status = "succeeded";

      const result = {
        mode: resolvedMode,
        answer: groundedAnswer.answer,
        enough_evidence: true,
        grounded: true,
        citations: groundedAnswer.citations,
        applied_filters: input.filters,
        total_results: search.totalCount,
        results: search.results,
        follow_up_suggestions: groundedAnswer.followUpSuggestions,
        request_id: requestId,
      } satisfies AssistantQueryResult;

      await safeRecordAssistantRequestTelemetry({
        requestId,
        action: "query",
        actor,
        requestedMode: input.mode,
        resolvedMode,
        authorizationOutcome: "allowed",
        outcome: "grounded_answer",
        failureClassification: failureDescriptor.classification,
        failureSubtype: failureDescriptor.subtype,
        grounded: true,
        enoughEvidence: true,
        noAnswer: false,
        resultCount: search.totalCount,
        citationCount: groundedAnswer.citations.length,
        filterSummary,
        stageTimings: timer.snapshot(),
        providerMetadata,
        metadata: {
          returned_result_count: result.results.length,
        },
      });

      return result;
    } catch (error) {
      const answerFailure = providerFailure(classifyProviderFailureSubtype("answering", error));
      providerMetadata.answering.status = "degraded";
      providerMetadata.answering.failure_subtype = answerFailure.subtype;

      const result = {
        mode: resolvedMode,
        answer: null,
        enough_evidence: true,
        grounded: false,
        citations: [],
        applied_filters: input.filters,
        total_results: search.totalCount,
        results: search.results,
        follow_up_suggestions: buildAskFollowUpSuggestions("answer_service_unavailable", search.totalCount),
        request_id: requestId,
      } satisfies AssistantQueryResult;

      await safeRecordAssistantRequestTelemetry({
        requestId,
        action: "query",
        actor,
        requestedMode: input.mode,
        resolvedMode,
        authorizationOutcome: "allowed",
        outcome: "provider_fallback",
        failureClassification: answerFailure.classification,
        failureSubtype: answerFailure.subtype,
        grounded: false,
        enoughEvidence: true,
        noAnswer: false,
        resultCount: search.totalCount,
        citationCount: 0,
        filterSummary,
        stageTimings: timer.snapshot(),
        providerMetadata,
        metadata: {
          returned_result_count: result.results.length,
        },
      });

      return result;
    }
  } catch (error) {
    const requestFailure = retrievalFailure("query_execution_failure");

    await safeRecordAssistantRequestTelemetry({
      requestId,
      action: "query",
      actor,
      requestedMode: input.mode,
      resolvedMode,
      authorizationOutcome: "allowed",
      outcome: "request_failed",
      failureClassification: requestFailure.classification,
      failureSubtype: requestFailure.subtype,
      grounded: false,
      enoughEvidence: false,
      noAnswer: false,
      resultCount: 0,
      citationCount: 0,
      filterSummary,
      stageTimings: timer.snapshot(),
      providerMetadata,
      metadata: {
        error_message: error instanceof Error ? error.message : "Assistant query failed.",
      },
    });

    throw error;
  }
}

function buildOpenTarget(source: AssistantSourceReference) {
  return {
    kind: "internal" as const,
    path: buildAssistantSourceOpenPath(source),
    label: "Open source detail",
  };
}

export async function getAssistantSourcePreview(
  actor: AssistantActorContext,
  source: AssistantSourceReference,
): Promise<AssistantSourcePreviewResult> {
  const requestId = randomUUID();
  const timer = createStageTimer();
  const providerMetadata = defaultProviderMetadata();

  try {
    const preview = await timer.measure("authorization_lookup_ms", async () => getAuthorizedAssistantEntrySource({
      actor,
      source,
    }));

    if (!preview) {
      const failure = permissionFailure("source_preview_denied");
      await safeRecordAssistantRequestTelemetry({
        requestId,
        action: "source-preview",
        actor,
        requestedMode: null,
        resolvedMode: null,
        authorizationOutcome: "denied",
        outcome: "permission_denied",
        failureClassification: failure.classification,
        failureSubtype: failure.subtype,
        grounded: false,
        enoughEvidence: false,
        noAnswer: false,
        resultCount: 0,
        citationCount: 0,
        filterSummary: null,
        stageTimings: timer.snapshot(),
        providerMetadata,
        metadata: {},
      });
      throw new AssistantAuthorizationError("You are not authorized to access that source.");
    }

    await safeRecordAssistantRequestTelemetry({
      requestId,
      action: "source-preview",
      actor,
      requestedMode: null,
      resolvedMode: null,
      authorizationOutcome: "allowed",
      outcome: "preview_served",
      failureClassification: "none",
      failureSubtype: null,
      grounded: false,
      enoughEvidence: false,
      noAnswer: false,
      resultCount: 0,
      citationCount: 0,
      filterSummary: null,
      stageTimings: timer.snapshot(),
      providerMetadata,
      metadata: buildSourceTelemetryMetadata(source),
    });

    return {
      preview: {
        source,
        title: preview.title,
        excerpt: preview.excerpt,
        metadata: preview.metadata,
        open_target: buildOpenTarget(source),
      },
    };
  } catch (error) {
    if (error instanceof AssistantAuthorizationError) {
      throw error;
    }

    const failure = retrievalFailure("source_preview_failure");
    await safeRecordAssistantRequestTelemetry({
      requestId,
      action: "source-preview",
      actor,
      requestedMode: null,
      resolvedMode: null,
      authorizationOutcome: "allowed",
      outcome: "request_failed",
      failureClassification: failure.classification,
      failureSubtype: failure.subtype,
      grounded: false,
      enoughEvidence: false,
      noAnswer: false,
      resultCount: 0,
      citationCount: 0,
      filterSummary: null,
      stageTimings: timer.snapshot(),
      providerMetadata,
      metadata: {
        ...buildSourceTelemetryMetadata(source),
        error_message: error instanceof Error ? error.message : "Assistant source preview failed.",
      },
    });
    throw error;
  }
}

export async function getAssistantSourceOpen(
  actor: AssistantActorContext,
  source: AssistantSourceReference,
): Promise<AssistantSourceOpenResult> {
  const requestId = randomUUID();
  const timer = createStageTimer();
  const providerMetadata = defaultProviderMetadata();

  try {
    const authorizedSource = await timer.measure("authorization_lookup_ms", async () => getAuthorizedAssistantEntrySource({
      actor,
      source,
    }));

    if (!authorizedSource) {
      const failure = permissionFailure("source_open_denied");
      await safeRecordAssistantRequestTelemetry({
        requestId,
        action: "source-open",
        actor,
        requestedMode: null,
        resolvedMode: null,
        authorizationOutcome: "denied",
        outcome: "permission_denied",
        failureClassification: failure.classification,
        failureSubtype: failure.subtype,
        grounded: false,
        enoughEvidence: false,
        noAnswer: false,
        resultCount: 0,
        citationCount: 0,
        filterSummary: null,
        stageTimings: timer.snapshot(),
        providerMetadata,
        metadata: {},
      });
      throw new AssistantAuthorizationError("You are not authorized to access that source.");
    }

    await safeRecordAssistantRequestTelemetry({
      requestId,
      action: "source-open",
      actor,
      requestedMode: null,
      resolvedMode: null,
      authorizationOutcome: "allowed",
      outcome: "source_opened",
      failureClassification: "none",
      failureSubtype: null,
      grounded: false,
      enoughEvidence: false,
      noAnswer: false,
      resultCount: 0,
      citationCount: 0,
      filterSummary: null,
      stageTimings: timer.snapshot(),
      providerMetadata,
      metadata: buildSourceTelemetryMetadata(source),
    });

    return {
      open: {
        source,
        target: buildOpenTarget(source),
      },
    };
  } catch (error) {
    if (error instanceof AssistantAuthorizationError) {
      throw error;
    }

    const failure = retrievalFailure("source_open_failure");
    await safeRecordAssistantRequestTelemetry({
      requestId,
      action: "source-open",
      actor,
      requestedMode: null,
      resolvedMode: null,
      authorizationOutcome: "allowed",
      outcome: "request_failed",
      failureClassification: failure.classification,
      failureSubtype: failure.subtype,
      grounded: false,
      enoughEvidence: false,
      noAnswer: false,
      resultCount: 0,
      citationCount: 0,
      filterSummary: null,
      stageTimings: timer.snapshot(),
      providerMetadata,
      metadata: {
        ...buildSourceTelemetryMetadata(source),
        error_message: error instanceof Error ? error.message : "Assistant source open failed.",
      },
    });
    throw error;
  }
}
