import { performance } from "node:perf_hooks";
import {
  classifyJobFailure,
  safeRecordAssistantJobTelemetry,
} from "../observability/metrics.js";
import { config } from "../config.js";
import { getEntryById } from "../db.js";
import {
  claimNextKnowledgeJob,
  enqueueReindexJob,
  getCurrentKnowledgeAssetVersion,
  getKnowledgeAssetBySourceId,
  listEntryIdsForBackfill,
  markKnowledgeJobRetried,
  markKnowledgeJobSucceeded,
  recoverStaleKnowledgeJobs,
  updateKnowledgeAssetStatus,
  upsertEntryKnowledgeAsset,
} from "./db.js";
import { indexEntryAsset } from "./ingestion.js";

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function computeRetryDelay(attemptCount: number) {
  return config.assistant.worker.retryBaseMs * (2 ** Math.max(0, attemptCount - 1));
}

export async function enqueueEntryReindex(entryId: string) {
  const entry = await getEntryById(entryId);
  if (!entry) return null;

  const asset = await upsertEntryKnowledgeAsset(entry);
  const job = await enqueueReindexJob(asset.id, entry.id);
  await safeRecordAssistantJobTelemetry({
    jobId: job.id,
    assetId: job.asset_id,
    assetVersionId: job.asset_version_id,
    sourceId: entry.id,
    jobType: job.job_type,
    eventType: "enqueue",
    status: job.status,
    attemptCount: job.attempt_count,
    workerId: job.worker_id,
    failureClassification: "none",
    failureSubtype: null,
    latencyMs: null,
    retryDelayMs: null,
    metadata: {
      source_table: "entries",
    },
  });
  return job;
}

export async function enqueueEntryBackfill(options: {
  enqueue?: (entryId: string) => Promise<unknown>;
} = {}) {
  const entryIds = await listEntryIdsForBackfill();
  const enqueue = options.enqueue ?? enqueueEntryReindex;
  let queuedCount = 0;

  for (const entryId of entryIds) {
    try {
      const job = await enqueue(entryId);
      if (job) {
        queuedCount += 1;
      }
    } catch (error) {
      console.error(`Failed to queue reindex for entry ${entryId}`, error);
    }
  }
  return queuedCount;
}

export async function processNextKnowledgeJob(
  workerId = `rag-worker-${process.pid}`,
  options: {
    indexAsset?: typeof indexEntryAsset;
  } = {},
) {
  const recoveredJobs = await recoverStaleKnowledgeJobs(config.assistant.worker.staleLockMs);
  for (const recoveredJob of recoveredJobs) {
    await safeRecordAssistantJobTelemetry({
      jobId: recoveredJob.id,
      assetId: recoveredJob.asset_id,
      assetVersionId: recoveredJob.asset_version_id,
      sourceId: typeof recoveredJob.payload.source_id === "string" ? recoveredJob.payload.source_id : null,
      jobType: recoveredJob.job_type,
      eventType: "stale_lock_recovered",
      status: recoveredJob.status,
      attemptCount: recoveredJob.attempt_count,
      workerId: recoveredJob.worker_id,
      failureClassification: "none",
      failureSubtype: null,
      latencyMs: null,
      retryDelayMs: null,
      metadata: {
        last_error: recoveredJob.last_error,
      },
    });
  }

  const job = await claimNextKnowledgeJob(workerId);
  if (!job) return null;

  await safeRecordAssistantJobTelemetry({
    jobId: job.id,
    assetId: job.asset_id,
    assetVersionId: job.asset_version_id,
    sourceId: typeof job.payload.source_id === "string" ? job.payload.source_id : null,
    jobType: job.job_type,
    eventType: "claimed",
    status: job.status,
    attemptCount: job.attempt_count,
    workerId,
    failureClassification: "none",
    failureSubtype: null,
    latencyMs: null,
    retryDelayMs: null,
  });

  const indexAsset = options.indexAsset ?? indexEntryAsset;
  const startedAt = performance.now();

  try {
    if (job.job_type !== "reindex") {
      throw new Error(`Unsupported job type: ${job.job_type}`);
    }

    const sourceId = String(job.payload.source_id ?? "");
    const entry = await getEntryById(sourceId);
    if (!entry) {
      const asset = await getKnowledgeAssetBySourceId(sourceId);
      if (asset) {
        await updateKnowledgeAssetStatus(asset.id, "failed");
      }
      throw new Error(`Entry ${sourceId} no longer exists.`);
    }

    const indexed = await indexAsset(entry);
    const updatedJob = await markKnowledgeJobSucceeded(job.id, indexed.version_id);
    await safeRecordAssistantJobTelemetry({
      jobId: job.id,
      assetId: indexed.asset_id,
      assetVersionId: indexed.version_id,
      sourceId,
      jobType: job.job_type,
      eventType: "succeeded",
      status: updatedJob?.status ?? "succeeded",
      attemptCount: updatedJob?.attempt_count ?? job.attempt_count,
      workerId,
      failureClassification: "none",
      failureSubtype: null,
      latencyMs: Math.round(performance.now() - startedAt),
      retryDelayMs: null,
      metadata: {
        changed: indexed.changed,
      },
    });
    return {
      job_id: job.id,
      asset_id: indexed.asset_id,
      version_id: indexed.version_id,
      changed: indexed.changed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge job failed.";
    const reachedRetryLimit = job.attempt_count >= config.assistant.worker.maxAttempts;
    const retryDelayMs = reachedRetryLimit ? 0 : computeRetryDelay(job.attempt_count);
    const failure = classifyJobFailure(error);

    const updatedJob = await markKnowledgeJobRetried(
      job,
      reachedRetryLimit ? "dead_letter" : "queued",
      message,
      retryDelayMs,
    );

    const sourceId = typeof job.payload.source_id === "string" ? job.payload.source_id : "";
    if (sourceId) {
      const asset = await getKnowledgeAssetBySourceId(sourceId);
      if (asset) {
        const currentVersion = await getCurrentKnowledgeAssetVersion(asset.id);
        const nextStatus = currentVersion
          ? "ready"
          : reachedRetryLimit
            ? "failed"
            : "pending";
        await updateKnowledgeAssetStatus(asset.id, nextStatus);
      }
    }

    await safeRecordAssistantJobTelemetry({
      jobId: job.id,
      assetId: job.asset_id,
      assetVersionId: updatedJob?.asset_version_id ?? job.asset_version_id,
      sourceId: sourceId || null,
      jobType: job.job_type,
      eventType: reachedRetryLimit ? "dead_letter" : "retry",
      status: updatedJob?.status ?? (reachedRetryLimit ? "dead_letter" : "queued"),
      attemptCount: updatedJob?.attempt_count ?? job.attempt_count,
      workerId,
      failureClassification: failure.classification,
      failureSubtype: failure.subtype,
      latencyMs: Math.round(performance.now() - startedAt),
      retryDelayMs,
      metadata: {
        error_message: message,
      },
    });

    return {
      job_id: job.id,
      error: message,
      dead_letter: reachedRetryLimit,
    };
  }
}

export async function startKnowledgeWorkerLoop(options: {
  workerId?: string;
  signal?: AbortSignal;
  processJob?: (workerId: string) => Promise<Awaited<ReturnType<typeof processNextKnowledgeJob>>>;
  sleep?: (ms: number) => Promise<void>;
} = {}) {
  const workerId = options.workerId ?? `rag-worker-${process.pid}`;
  const processJob = options.processJob ?? ((nextWorkerId: string) => processNextKnowledgeJob(nextWorkerId));
  const sleep = options.sleep ?? delay;

  while (!options.signal?.aborted) {
    try {
      const processed = await processJob(workerId);
      if (!processed && !options.signal?.aborted) {
        await sleep(config.assistant.worker.pollIntervalMs);
      }
    } catch (error) {
      console.error("RAG worker iteration failed", error);
      if (!options.signal?.aborted) {
        await sleep(config.assistant.worker.pollIntervalMs);
      }
    }
  }
}
