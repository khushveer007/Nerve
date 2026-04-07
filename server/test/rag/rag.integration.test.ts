import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreateEntryInput } from "../../db.js";
import type { AssistantLaunchSummary } from "../../observability/types.js";
import type { AssistantQueryFilters } from "../../rag/types.js";
import {
  createTestRuntime,
  drainKnowledgeJobs,
  loginAndGetSessionCookie,
  startHttpServer,
  stopHttpServer,
} from "./test-utils.js";

type TestRuntime = Awaited<ReturnType<typeof createTestRuntime>>;

const cleanups: Array<() => Promise<void>> = [];
const EMPTY_FILTERS: AssistantQueryFilters = {
  department: null,
  date_range: {
    start: null,
    end: null,
  },
  sort: "relevance" as const,
};

afterEach(async () => {
  vi.restoreAllMocks();
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    if (cleanup) {
      await cleanup();
    }
  }
});

const SUPER_ADMIN_ACTOR = {
  authenticated: true as const,
  user_id: "sa-001",
  role: "super_admin" as const,
  team_id: null,
};

function buildEmbedding(index: number) {
  return Array.from({ length: 1536 }, (_, current) => (current === index ? 1 : 0));
}

async function setAssetEmbedding(
  runtime: TestRuntime,
  assetId: string,
  embedding: number[],
) {
  await runtime.modules.db.pool.query(
    `UPDATE knowledge_chunks
        SET embedding = $2::vector
      WHERE asset_id = $1`,
    [assetId, JSON.stringify(embedding)],
  );
}

async function createIndexedEntry(
  runtime: TestRuntime,
  input: CreateEntryInput,
) {
  const entry = await runtime.modules.db.createEntry(input);
  await runtime.modules.jobs.enqueueEntryReindex(entry.id);
  await drainKnowledgeJobs(runtime.modules.jobs);

  const asset = await runtime.modules.ragDb.getKnowledgeAssetBySourceId(entry.id);
  if (!asset) {
    throw new Error(`Expected an indexed knowledge asset for entry ${entry.id}.`);
  }

  return { entry, asset };
}

async function getSourceReference(
  runtime: TestRuntime,
  assetId: string,
  entryId: string,
) {
  const row = await runtime.modules.db.pool.query<{
    asset_version_id: string;
    chunk_id: string;
  }>(
    `SELECT kc.asset_version_id, kc.id AS chunk_id
       FROM knowledge_chunks kc
      WHERE kc.asset_id = $1
      ORDER BY kc.chunk_no ASC
      LIMIT 1`,
    [assetId],
  );

  const source = row.rows[0];
  if (!source) {
    throw new Error(`Expected a source chunk for asset ${assetId}.`);
  }

  return {
    asset_id: assetId,
    asset_version_id: source.asset_version_id,
    chunk_id: source.chunk_id,
    entry_id: entryId,
    source_kind: "entry" as const,
  };
}

async function getLatestRequestTelemetry(
  runtime: TestRuntime,
  action: "query" | "source-preview" | "source-open" = "query",
) {
  const result = await runtime.modules.db.pool.query<{
    request_id: string;
    action: "query" | "source-preview" | "source-open";
    outcome: string;
    failure_classification: string;
    failure_subtype: string | null;
    authorization_outcome: string;
    result_count: number;
    citation_count: number;
    grounded: boolean;
    enough_evidence: boolean;
    no_answer: boolean;
    filter_summary: Record<string, unknown>;
    stage_timings: Record<string, number>;
    metadata: Record<string, unknown>;
    provider_metadata: {
      embeddings: { status: string; failure_subtype: string | null };
      answering: { status: string; failure_subtype: string | null };
    };
  }>(
    `SELECT
      request_id,
      action,
      outcome,
      failure_classification,
      failure_subtype,
      authorization_outcome,
      result_count,
      citation_count,
      grounded,
      enough_evidence,
      no_answer,
      filter_summary,
      stage_timings,
      metadata,
      provider_metadata
     FROM assistant_request_telemetry
     WHERE action = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [action],
  );

  return result.rows[0] ?? null;
}

function buildJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function resolveMockEmbeddingIndex(text: string) {
  const normalized = text.toLowerCase();

  if (
    normalized.includes("aurora")
    || normalized.includes("semantic-aurora-intent")
    || normalized.includes("lumen graph ember slate")
  ) {
    return 0;
  }

  if (
    normalized.includes("orchard")
    || normalized.includes("pebble harbor mint lantern")
  ) {
    return 1;
  }

  return 2;
}

async function postJson<TResponse>(
  baseUrl: string,
  path: string,
  cookie: string,
  body: unknown,
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json() as TResponse;

  return {
    response,
    payload,
  };
}

function buildLaunchEvaluationSummary(
  metrics: AssistantLaunchSummary,
  scenarios: Array<{ category: string; passed: boolean; blocker: string }>,
) {
  const blockers = scenarios
    .filter((scenario) => !scenario.passed)
    .map((scenario) => scenario.blocker);

  if (
    metrics.quality_metrics.citation_coverage_rate !== null
    && metrics.quality_metrics.citation_coverage_rate < 1
  ) {
    blockers.push("Grounded answers are missing citation coverage in the launch telemetry summary.");
  }

  if (metrics.latency.search.within_target === false) {
    blockers.push(
      `Launch telemetry summary shows search p95 latency ${metrics.latency.search.p95_ms} ms above target ${metrics.latency.search.target_ms} ms.`,
    );
  }

  if (metrics.latency.ask.within_target === false) {
    blockers.push(
      `Launch telemetry summary shows ask p95 latency ${metrics.latency.ask.p95_ms} ms above target ${metrics.latency.ask.target_ms} ms.`,
    );
  }

  return {
    launch_ready: blockers.length === 0,
    blockers,
    scenarios,
    metrics,
  };
}

async function listJobTelemetryEvents(
  runtime: TestRuntime,
  jobId: string,
) {
  const result = await runtime.modules.db.pool.query<{
    event_type: string;
    status: string | null;
    failure_classification: string;
    failure_subtype: string | null;
  }>(
    `SELECT event_type, status, failure_classification, failure_subtype
       FROM assistant_job_telemetry
      WHERE job_id = $1
      ORDER BY created_at ASC`,
    [jobId],
  );

  return result.rows;
}

function buildAnswerProviderPayload(claims: Array<{ text: string; citations: string[] }>) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            claims,
            follow_up_suggestions: [
              "Open a supporting source below if you want to verify the cited entry evidence.",
            ],
          }),
        },
      },
    ],
  };
}

describe("Story 1.2 RAG backend", () => {
  it("runs the migration runner idempotently and safely under parallel startup", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await Promise.all([
      runtime.modules.ragDb.runRagMigrations(),
      runtime.modules.ragDb.runRagMigrations(),
    ]);
    await runtime.modules.ragDb.runRagMigrations();

    expect(await runtime.modules.ragDb.getRagMigrationCount()).toBe(4);

    const tables = await runtime.modules.db.pool.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name LIKE 'knowledge_%'
        ORDER BY table_name ASC`,
    );

    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "knowledge_acl_principals",
      "knowledge_asset_versions",
      "knowledge_assets",
      "knowledge_chunks",
      "knowledge_jobs",
    ]);
  });

  it("backfills seeded entries into knowledge assets, versions, and chunks with preserved metadata", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const assetCounts = await runtime.modules.db.pool.query<{
      asset_count: number;
      version_count: number;
      chunk_count: number;
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM knowledge_assets WHERE source_kind = 'entry') AS asset_count,
        (SELECT COUNT(*)::int FROM knowledge_asset_versions) AS version_count,
        (SELECT COUNT(*)::int FROM knowledge_chunks) AS chunk_count
    `);

    const seededEntries = await runtime.modules.db.listEntries();
    expect(assetCounts.rows[0]?.asset_count).toBe(seededEntries.length);
    expect(assetCounts.rows[0]?.version_count).toBe(seededEntries.length);
    expect(assetCounts.rows[0]?.chunk_count).toBeGreaterThanOrEqual(seededEntries.length);

    const adobeEntry = seededEntries.find((entry) => entry.title.includes("Adobe"));
    expect(adobeEntry).toBeTruthy();

    const adobeAsset = await runtime.modules.ragDb.getKnowledgeAssetBySourceId(adobeEntry!.id);
    expect(adobeAsset?.source_kind).toBe("entry");
    expect(adobeAsset?.metadata.dept).toBe("Design");
    expect(adobeAsset?.metadata.collaborating_org).toBe("Adobe Inc.");

    const chunk = await runtime.modules.db.pool.query<{
      content: string;
      metadata: { priority: string };
      citation_locator: { heading_path: string[] };
    }>(
      `SELECT kc.content, kc.metadata, kc.citation_locator
         FROM knowledge_chunks kc
         INNER JOIN knowledge_assets ka ON ka.id = kc.asset_id
        WHERE ka.source_id = $1
        ORDER BY kc.chunk_no ASC
        LIMIT 1`,
      [adobeEntry!.id],
    );

    expect(chunk.rows[0]?.content).toContain("Title: Design Department Partners with Adobe for Creative Suite");
    expect(chunk.rows[0]?.metadata.priority).toBe("Normal");
    expect(chunk.rows[0]?.citation_locator.heading_path).toEqual(["Entry overview"]);
  });

  it("keeps indexed entries searchable while a fresh reindex is queued", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const entry = (await runtime.modules.db.listEntries()).find((item) => item.title.includes("Adobe"));
    expect(entry).toBeTruthy();

    await runtime.modules.jobs.enqueueEntryReindex(entry!.id);

    const asset = await runtime.modules.ragDb.getKnowledgeAssetBySourceId(entry!.id);
    expect(asset?.status).toBe("ready");

    const activeJobs = await runtime.modules.db.pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM knowledge_jobs
        WHERE asset_id = $1
          AND status IN ('queued', 'running')`,
      [asset!.id],
    );

    expect(activeJobs.rows[0]?.count).toBe(1);

    const searchResults = await runtime.modules.ragDb.searchEntryKnowledge({
      actor: SUPER_ADMIN_ACTOR,
      queryText: "Adobe Creative Suite",
      filters: EMPTY_FILTERS,
      limit: 5,
    });

    expect(searchResults.results[0]?.entry_id).toBe(entry!.id);
  });

  it("skips already-ready entries when startup backfill runs again", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const queuedCount = await runtime.modules.jobs.enqueueEntryBackfill();
    expect(queuedCount).toBe(0);

    const pendingJobs = await runtime.modules.db.pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM knowledge_jobs
        WHERE status IN ('queued', 'running')`,
    );

    expect(pendingJobs.rows[0]?.count).toBe(0);
  });

  it("supersedes older indexed versions when an entry is updated", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const entry = (await runtime.modules.db.listEntries()).find((item) => item.title.includes("Adobe"));
    expect(entry).toBeTruthy();

    const firstAsset = await runtime.modules.ragDb.getKnowledgeAssetBySourceId(entry!.id);
    const firstVersion = await runtime.modules.ragDb.getCurrentKnowledgeAssetVersion(firstAsset!.id);
    expect(firstVersion?.version_no).toBe(1);

    await runtime.modules.db.updateEntry(entry!.id, {
      body: `${entry!.body}\n\nThe partnership now also includes Adobe Firefly training labs for faculty and students.`,
      priority: "High",
    });
    await runtime.modules.jobs.enqueueEntryReindex(entry!.id);
    await drainKnowledgeJobs(runtime.modules.jobs);

    const secondVersion = await runtime.modules.ragDb.getCurrentKnowledgeAssetVersion(firstAsset!.id);
    expect(secondVersion?.version_no).toBe(2);

    const versions = await runtime.modules.db.pool.query<{
      version_no: number;
      extraction_status: string;
      superseded_at: string | null;
    }>(
      `SELECT version_no, extraction_status, superseded_at
         FROM knowledge_asset_versions
        WHERE asset_id = $1
        ORDER BY version_no ASC`,
      [firstAsset!.id],
    );

    expect(versions.rows).toHaveLength(2);
    expect(versions.rows[0]?.extraction_status).toBe("superseded");
    expect(versions.rows[0]?.superseded_at).not.toBeNull();
    expect(versions.rows[1]?.extraction_status).toBe("ready");

    const searchResults = await runtime.modules.ragDb.searchEntryKnowledge({
      actor: SUPER_ADMIN_ACTOR,
      queryText: "Firefly training labs",
      filters: EMPTY_FILTERS,
      limit: 5,
    });

    expect(searchResults.results[0]?.title).toContain("Adobe");
    expect(searchResults.results[0]?.snippet).toContain("Firefly training labs");
  });

  it("keeps the current ready version searchable when a reindex attempt fails", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const entry = (await runtime.modules.db.listEntries()).find((item) => item.title.includes("Adobe"));
    expect(entry).toBeTruthy();

    await runtime.modules.jobs.enqueueEntryReindex(entry!.id);

    const processed = await runtime.modules.jobs.processNextKnowledgeJob("test-rag-worker", {
      indexAsset: async () => {
        throw new Error("Simulated indexing failure.");
      },
    });

    expect(processed).toMatchObject({
      dead_letter: false,
      error: "Simulated indexing failure.",
    });

    const asset = await runtime.modules.ragDb.getKnowledgeAssetBySourceId(entry!.id);
    expect(asset?.status).toBe("ready");

    const searchResults = await runtime.modules.ragDb.searchEntryKnowledge({
      actor: SUPER_ADMIN_ACTOR,
      queryText: "Adobe Creative Suite",
      filters: EMPTY_FILTERS,
      limit: 5,
    });

    expect(searchResults.results[0]?.entry_id).toBe(entry!.id);
  });

  it("retries failed jobs and moves them to dead_letter after the retry limit", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    await runtime.modules.db.pool.query(
      `INSERT INTO knowledge_assets (
        id,
        source_kind,
        source_table,
        source_id,
        title,
        mime_type,
        media_type,
        storage_backend,
        size_bytes,
        visibility_scope,
        status,
        metadata
      ) VALUES (
        'asset-missing-entry',
        'entry',
        'entries',
        'entry-does-not-exist',
        'Missing entry asset',
        'text/markdown',
        'text',
        'database',
        0,
        'authenticated',
        'pending',
        '{}'::jsonb
      )`,
    );

    const queuedJob = await runtime.modules.ragDb.enqueueReindexJob("asset-missing-entry", "entry-does-not-exist");
    await runtime.modules.jobs.processNextKnowledgeJob("test-rag-worker");
    await runtime.modules.jobs.processNextKnowledgeJob("test-rag-worker");

    const jobStatus = await runtime.modules.db.pool.query<{
      status: string;
      attempt_count: number;
      last_error: string;
    }>(
      `SELECT status, attempt_count, last_error
         FROM knowledge_jobs
        WHERE asset_id = 'asset-missing-entry'
        ORDER BY created_at DESC
        LIMIT 1`,
    );

    expect(jobStatus.rows[0]?.status).toBe("dead_letter");
    expect(jobStatus.rows[0]?.attempt_count).toBe(2);
    expect(jobStatus.rows[0]?.last_error).toContain("entry-does-not-exist");

    const events = await listJobTelemetryEvents(runtime, queuedJob.id);
    expect(events.map((event) => event.event_type)).toEqual(
      expect.arrayContaining(["claimed", "retry", "dead_letter"]),
    );
    expect(events.some((event) => event.failure_classification === "retrieval_failure")).toBe(true);
  });

  it("continues queueing other entries when one startup backfill enqueue fails", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    const entries = await runtime.modules.db.listEntries();
    const attempted: string[] = [];
    const failedEntryId = entries[0]!.id;

    const queuedCount = await runtime.modules.jobs.enqueueEntryBackfill({
      enqueue: async (entryId) => {
        attempted.push(entryId);
        if (entryId === failedEntryId) {
          throw new Error("Simulated queue failure.");
        }
        return { job_id: `job-${entryId}` };
      },
    });

    expect(queuedCount).toBe(entries.length - 1);
    expect([...attempted].sort()).toEqual(entries.map((entry) => entry.id).sort());
  });

  it("keeps the worker loop alive after a transient processing failure", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    const sleeps: number[] = [];
    let attempts = 0;
    const abortController = new AbortController();

    await runtime.modules.jobs.startKnowledgeWorkerLoop({
      signal: abortController.signal,
      processJob: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("Temporary worker failure.");
        }

        abortController.abort();
        return null;
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    expect(attempts).toBe(2);
    expect(sleeps).toEqual([0]);
  });

  it("serves authenticated assistant queries from the indexed entry corpus", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    const indexModule = await import("../../index.js");
    await indexModule.prepareApiRuntime();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const { server, baseUrl } = await startHttpServer(indexModule.app);
    const cookie = await loginAndGetSessionCookie(baseUrl);

    const response = await fetch(`${baseUrl}/api/assistant/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        query: {
          mode: "search",
          text: "NABH accreditation",
          filters: {
            departments: [],
            entry_types: [],
            priorities: [],
            tags: [],
          },
        },
      }),
    });

    const payload = await response.json() as {
      result: {
        grounded: boolean;
        enough_evidence: boolean;
        results: Array<{
          source_kind: string;
          title: string;
          entry_id: string;
          snippet: string;
          metadata: { dept: string };
        }>;
      };
    };

    await stopHttpServer(server);

    expect(response.ok).toBe(true);
    expect(payload.result.grounded).toBe(false);
    expect(payload.result.enough_evidence).toBe(true);
    expect(payload.result.results[0]?.source_kind).toBe("entry");
    expect(payload.result.results[0]?.title).toContain("NABH");
    expect(payload.result.results[0]?.metadata.dept).toBe("Medical");
    expect(payload.result.results[0]?.snippet).toContain("NABH Accreditation");
  });

  it("launch-quality gate: filters team-scoped entry results down to the actor's team before snippets and citations are built", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    const indexModule = await import("../../index.js");
    await indexModule.prepareApiRuntime();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const scopedEntry = await createIndexedEntry(runtime, {
      title: "Team Scope Story 1.3 Result",
      dept: "Design",
      type: "Notice",
      body: "Team scope story 1.3 result body for ACL validation.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "bu-001",
      tags: ["team-scope"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    await runtime.modules.db.pool.query(
      `UPDATE knowledge_assets
          SET visibility_scope = 'team',
              owner_team_id = 'branding',
              updated_at = NOW()
        WHERE id = $1`,
      [scopedEntry.asset.id],
    );

    const { server, baseUrl } = await startHttpServer(indexModule.app);

    try {
      const contentCookie = await loginAndGetSessionCookie(baseUrl, {
        email: "content-user@parul.ac.in",
        password: "contentuser123",
      });
      const blockedResponse = await fetch(`${baseUrl}/api/assistant/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: contentCookie,
        },
        body: JSON.stringify({
          query: {
            mode: "search",
            text: "Team Scope Story 1.3 Result",
            filters: {
              departments: [],
              entry_types: [],
              priorities: [],
              tags: [],
            },
          },
        }),
      });

      const blockedPayload = await blockedResponse.json() as {
        result: {
          results: Array<{ title: string }>;
          citations?: Array<{ title: string }>;
        };
      };

      expect(blockedResponse.ok).toBe(true);
      expect(blockedPayload.result.results).toHaveLength(0);
      expect(blockedPayload.result.citations).toHaveLength(0);

      const brandingCookie = await loginAndGetSessionCookie(baseUrl, {
        email: "brand-user@parul.ac.in",
        password: "branduser123",
      });
      const allowedResponse = await fetch(`${baseUrl}/api/assistant/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: brandingCookie,
        },
        body: JSON.stringify({
          query: {
            mode: "search",
            text: "Team Scope Story 1.3 Result",
            filters: {
              departments: [],
              entry_types: [],
              priorities: [],
              tags: [],
            },
          },
        }),
      });

      const allowedPayload = await allowedResponse.json() as {
        result: {
          results: Array<{ title: string; snippet: string }>;
          citations?: Array<{ title: string }>;
        };
      };

      expect(allowedResponse.ok).toBe(true);
      expect(allowedPayload.result.results).toHaveLength(1);
      expect(allowedPayload.result.results[0]?.title).toContain("Team Scope Story 1.3 Result");
      expect(allowedPayload.result.results[0]?.snippet).toContain("ACL validation");
      expect(allowedPayload.result.citations ?? []).toHaveLength(0);
    } finally {
      await stopHttpServer(server);
    }
  });

  it("launch-quality gate: allows owner-scoped results only to the owning user", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    const indexModule = await import("../../index.js");
    await indexModule.prepareApiRuntime();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const ownerEntry = await createIndexedEntry(runtime, {
      title: "Owner Scope Story 1.3 Result",
      dept: "Design",
      type: "Notice",
      body: "Owner scope story 1.3 result body for ACL validation.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "bu-001",
      tags: ["owner-scope"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    await runtime.modules.db.pool.query(
      `UPDATE knowledge_assets
          SET visibility_scope = 'owner',
              owner_user_id = 'bu-001',
              owner_team_id = 'branding',
              updated_at = NOW()
        WHERE id = $1`,
      [ownerEntry.asset.id],
    );

    const { server, baseUrl } = await startHttpServer(indexModule.app);

    try {
      const nonOwnerCookie = await loginAndGetSessionCookie(baseUrl, {
        email: "brand-lead@parul.ac.in",
        password: "brandlead123",
      });
      const blockedResponse = await fetch(`${baseUrl}/api/assistant/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: nonOwnerCookie,
        },
        body: JSON.stringify({
          query: {
            mode: "search",
            text: "Owner Scope Story 1.3 Result",
            filters: {
              departments: [],
              entry_types: [],
              priorities: [],
              tags: [],
            },
          },
        }),
      });

      const blockedPayload = await blockedResponse.json() as {
        result: {
          results: Array<{ title: string }>;
        };
      };

      expect(blockedResponse.ok).toBe(true);
      expect(blockedPayload.result.results).toHaveLength(0);

      const ownerCookie = await loginAndGetSessionCookie(baseUrl, {
        email: "brand-user@parul.ac.in",
        password: "branduser123",
      });
      const ownerResponse = await fetch(`${baseUrl}/api/assistant/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: ownerCookie,
        },
        body: JSON.stringify({
          query: {
            mode: "search",
            text: "Owner Scope Story 1.3 Result",
            filters: {
              departments: [],
              entry_types: [],
              priorities: [],
              tags: [],
            },
          },
        }),
      });

      const ownerPayload = await ownerResponse.json() as {
        result: {
          results: Array<{ title: string }>;
        };
      };

      expect(ownerResponse.ok).toBe(true);
      expect(ownerPayload.result.results).toHaveLength(1);
      expect(ownerPayload.result.results[0]?.title).toContain("Owner Scope Story 1.3 Result");
    } finally {
      await stopHttpServer(server);
    }
  });

  it("launch-quality gate: honors explicit ACL principals and rejects unauthorized preview/open requests without metadata leakage", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    const indexModule = await import("../../index.js");
    await indexModule.prepareApiRuntime();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const explicitEntry = await createIndexedEntry(runtime, {
      title: "Explicit ACL Story 1.3 Result",
      dept: "Sciences",
      type: "Notice",
      body: "Explicit ACL story 1.3 result body for preview and open validation.",
      priority: "High",
      entry_date: "2026-04-06",
      created_by: "ca-001",
      tags: ["explicit-acl"],
      author_name: "Content Admin",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    await runtime.modules.db.pool.query(
      `UPDATE knowledge_assets
          SET visibility_scope = 'explicit_acl',
              owner_team_id = 'content',
              updated_at = NOW()
        WHERE id = $1`,
      [explicitEntry.asset.id],
    );
    await runtime.modules.db.pool.query(
      `INSERT INTO knowledge_acl_principals (id, asset_id, principal_type, principal_id, permission)
       VALUES ($1, $2, 'team', 'content', 'read')`,
      [`acl-${explicitEntry.asset.id}`, explicitEntry.asset.id],
    );

    const sourceReference = await getSourceReference(runtime, explicitEntry.asset.id, explicitEntry.entry.id);
    const { server, baseUrl } = await startHttpServer(indexModule.app);

    try {
      const brandingCookie = await loginAndGetSessionCookie(baseUrl, {
        email: "brand-user@parul.ac.in",
        password: "branduser123",
      });
      const blockedQuery = await fetch(`${baseUrl}/api/assistant/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: brandingCookie,
        },
        body: JSON.stringify({
          query: {
            mode: "search",
            text: "Explicit ACL Story 1.3 Result",
            filters: {
              departments: [],
              entry_types: [],
              priorities: [],
              tags: [],
            },
          },
        }),
      });
      const blockedQueryPayload = await blockedQuery.json() as {
        result: {
          results: Array<{ title: string }>;
          citations: Array<{ title: string }>;
        };
      };

      expect(blockedQuery.ok).toBe(true);
      expect(blockedQueryPayload.result.results).toHaveLength(0);
      expect(blockedQueryPayload.result.citations).toHaveLength(0);

      const blockedPreview = await fetch(`${baseUrl}/api/assistant/source-preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: brandingCookie,
        },
        body: JSON.stringify({
          preview: {
            source: sourceReference,
          },
        }),
      });
      const blockedPreviewPayload = await blockedPreview.json() as { message: string };

      expect(blockedPreview.status).toBe(403);
      expect(blockedPreviewPayload.message).toBe("You are not authorized to access that source.");
      expect(JSON.stringify(blockedPreviewPayload)).not.toContain("Explicit ACL Story 1.3 Result");

      const blockedPreviewTelemetry = await getLatestRequestTelemetry(runtime, "source-preview");
      expect(blockedPreviewTelemetry?.authorization_outcome).toBe("denied");
      expect(blockedPreviewTelemetry?.outcome).toBe("permission_denied");
      expect(blockedPreviewTelemetry?.failure_classification).toBe("permission_failure");
      expect(blockedPreviewTelemetry?.metadata ?? {}).toEqual({});

      const blockedOpen = await fetch(`${baseUrl}/api/assistant/source-open`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: brandingCookie,
        },
        body: JSON.stringify({
          open: {
            source: sourceReference,
          },
        }),
      });
      const blockedOpenPayload = await blockedOpen.json() as { message: string };

      expect(blockedOpen.status).toBe(403);
      expect(blockedOpenPayload.message).toBe("You are not authorized to access that source.");
      expect(JSON.stringify(blockedOpenPayload)).not.toContain("Explicit ACL Story 1.3 Result");

      const blockedOpenTelemetry = await getLatestRequestTelemetry(runtime, "source-open");
      expect(blockedOpenTelemetry?.authorization_outcome).toBe("denied");
      expect(blockedOpenTelemetry?.outcome).toBe("permission_denied");
      expect(blockedOpenTelemetry?.failure_classification).toBe("permission_failure");
      expect(blockedOpenTelemetry?.metadata ?? {}).toEqual({});

      const contentCookie = await loginAndGetSessionCookie(baseUrl, {
        email: "content-user@parul.ac.in",
        password: "contentuser123",
      });

      const allowedPreview = await fetch(`${baseUrl}/api/assistant/source-preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: contentCookie,
        },
        body: JSON.stringify({
          preview: {
            source: sourceReference,
          },
        }),
      });
      const allowedPreviewPayload = await allowedPreview.json() as {
        preview: {
          title: string;
          excerpt: string;
          open_target: { path: string };
        };
      };

      expect(allowedPreview.ok).toBe(true);
      expect(allowedPreviewPayload.preview.title).toContain("Explicit ACL Story 1.3 Result");
      expect(allowedPreviewPayload.preview.excerpt).toContain("preview and open validation");
      expect(allowedPreviewPayload.preview.open_target.path).toContain("/browse/source?");
    } finally {
      await stopHttpServer(server);
    }
  });

  it("returns grounded ask answers when accessible evidence is sufficient", async () => {
    const runtime = await createTestRuntime({
      ASSISTANT_ANSWER_URL: "https://answers.test/v1/chat/completions",
    });
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => buildAnswerProviderPayload([
        {
          text: "The medical college has NABH accreditation for patient care, infrastructure, and clinical outcomes.",
          citations: ["S1"],
        },
      ]),
    } as Response);

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "ask",
      text: "Summarize what Nerve says about NABH accreditation.",
      filters: EMPTY_FILTERS,
    });

    expect(result.mode).toBe("ask");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.answer).toContain("NABH accreditation");
    expect(result.answer).toContain("[S1]");
    expect(result.grounded).toBe(true);
    expect(result.enough_evidence).toBe(true);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.title).toContain("NABH");
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.follow_up_suggestions[0]).toMatch(/supporting source/i);

    const telemetry = await getLatestRequestTelemetry(runtime);
    expect(telemetry?.request_id).toBe(result.request_id);
    expect(telemetry?.outcome).toBe("grounded_answer");
    expect(telemetry?.failure_classification).toBe("none");
    expect(telemetry?.citation_count).toBe(1);
    expect(telemetry?.provider_metadata.answering.status).toBe("succeeded");
    expect(telemetry?.stage_timings.answer_generation_ms).toEqual(expect.any(Number));
  });

  it("routes sufficient synthesis-style auto queries to grounded ask answers", async () => {
    const runtime = await createTestRuntime({
      ASSISTANT_ANSWER_URL: "https://answers.test/v1/chat/completions",
    });
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => buildAnswerProviderPayload([
        {
          text: "The medical college has NABH accreditation according to the indexed entry corpus.",
          citations: ["S1"],
        },
      ]),
    } as Response);

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "auto",
      text: "Explain what Nerve says about NABH accreditation.",
      filters: EMPTY_FILTERS,
    });

    expect(result.mode).toBe("ask");
    expect(result.grounded).toBe(true);
    expect(result.answer).toContain("[S1]");
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("keeps ambiguous auto queries explainable by resolving them to search mode", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "auto",
      text: "NABH accreditation",
      filters: EMPTY_FILTERS,
    });

    expect(result.mode).toBe("search");
    expect(result.answer).toBeNull();
    expect(result.grounded).toBe(false);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("uses query-time embeddings to return semantic matches when lexical retrieval alone would miss them", async () => {
    const runtime = await createTestRuntime({
      ASSISTANT_EMBEDDING_URL: "https://embeddings.test/v1/embeddings",
    });
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    const semanticEntry = await createIndexedEntry(runtime, {
      title: "Project Aurora",
      dept: "Design",
      type: "Notice",
      body: "Lumen graph ember slate.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "bu-001",
      tags: ["aurora"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });
    const distractorEntry = await createIndexedEntry(runtime, {
      title: "Project Orchard",
      dept: "Medical",
      type: "Notice",
      body: "Pebble harbor mint lantern.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "ca-001",
      tags: ["orchard"],
      author_name: "Content Admin",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    await setAssetEmbedding(runtime, semanticEntry.asset.id, buildEmbedding(0));
    await setAssetEmbedding(runtime, distractorEntry.asset.id, buildEmbedding(1));

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: buildEmbedding(0) }],
      }),
    } as Response);

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "search",
      text: "semantic-aurora-intent",
      filters: EMPTY_FILTERS,
    });

    expect(result.results[0]?.title).toBe("Project Aurora");
    expect(result.results).toHaveLength(1);
  });

  it("falls back to lexical hybrid retrieval when query-time embeddings are unavailable", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "search",
      text: "Adobe Creative Suite",
      filters: EMPTY_FILTERS,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.results[0]?.title).toContain("Adobe");
  });

  it("records provider degradation telemetry when query-time embeddings time out but lexical retrieval still succeeds", async () => {
    const runtime = await createTestRuntime({
      ASSISTANT_EMBEDDING_URL: "https://embeddings.test/v1/embeddings",
    });
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: buildEmbedding(0) }],
      }),
    } as Response);

    await createIndexedEntry(runtime, {
      title: "Adobe Creative Suite Telemetry",
      dept: "Design",
      type: "Notice",
      body: "Adobe Creative Suite telemetry reference for lexical fallback validation.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "bu-001",
      tags: ["adobe", "telemetry"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    fetchSpy.mockReset();
    fetchSpy.mockRejectedValue(new Error("Embedding request timed out."));

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "search",
      text: "Adobe Creative Suite",
      filters: EMPTY_FILTERS,
    });

    expect(result.results[0]?.title).toContain("Adobe");

    const telemetry = await getLatestRequestTelemetry(runtime);
    expect(telemetry?.outcome).toBe("search_results");
    expect(telemetry?.failure_classification).toBe("provider_failure");
    expect(telemetry?.failure_subtype).toBe("embedding_timeout");
    expect(telemetry?.provider_metadata.embeddings.status).toBe("degraded");
    expect(telemetry?.provider_metadata.embeddings.failure_subtype).toBe("embedding_timeout");
    expect(telemetry?.stage_timings.embeddings_ms).toEqual(expect.any(Number));
  });

  it("keeps ACL enforcement inside hybrid candidate generation when semantic retrieval is enabled", async () => {
    const runtime = await createTestRuntime({
      ASSISTANT_EMBEDDING_URL: "https://embeddings.test/v1/embeddings",
    });
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    const accessibleEntry = await createIndexedEntry(runtime, {
      title: "Aurora Access",
      dept: "Design",
      type: "Notice",
      body: "Lumen graph ember slate.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "bu-001",
      tags: ["aurora-access"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });
    const restrictedEntry = await createIndexedEntry(runtime, {
      title: "Prism Access",
      dept: "Design",
      type: "Notice",
      body: "Pebble harbor mint lantern.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "bu-001",
      tags: ["prism-access"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    await runtime.modules.db.pool.query(
      `UPDATE knowledge_assets
          SET visibility_scope = 'team',
              owner_team_id = 'branding',
              updated_at = NOW()
        WHERE id = $1`,
      [restrictedEntry.asset.id],
    );

    await setAssetEmbedding(runtime, accessibleEntry.asset.id, buildEmbedding(0));
    await setAssetEmbedding(runtime, restrictedEntry.asset.id, buildEmbedding(0));

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: buildEmbedding(0) }],
      }),
    } as Response);

    const contentActor = {
      authenticated: true as const,
      user_id: "cu-001",
      role: "user" as const,
      team_id: "content",
    };

    const result = await runtime.modules.service.executeAssistantQuery(contentActor, {
      mode: "search",
      text: "semantic-acl-intent",
      filters: EMPTY_FILTERS,
    });

    expect(result.results.map((item) => item.title)).toContain("Aurora Access");
    expect(result.results.map((item) => item.title)).not.toContain("Prism Access");
  });

  it("returns neutral no-results guidance with refinement suggestions", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "auto",
      text: "Summarize the starlight orchard policy memo.",
      filters: EMPTY_FILTERS,
    });

    expect(result.mode).toBe("ask");
    expect(result.results).toHaveLength(0);
    expect(result.follow_up_suggestions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/exact entry title/i),
        expect.stringMatching(/phase 1/i),
      ]),
    );
  });

  it("keeps zero-result search guidance neutral instead of upselling ask mode", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "search",
      text: "Summarize the starlight orchard policy memo.",
      filters: EMPTY_FILTERS,
    });

    expect(result.mode).toBe("search");
    expect(result.results).toHaveLength(0);
    expect(result.follow_up_suggestions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/exact entry title/i),
        expect.stringMatching(/phase 1/i),
      ]),
    );
    expect(result.follow_up_suggestions.join(" ")).not.toMatch(/use ask mode/i);
  });

  it("abstains without calling the answer model when evidence is too weak", async () => {
    const runtime = await createTestRuntime({
      ASSISTANT_ANSWER_URL: "https://answers.test/v1/chat/completions",
    });
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    await createIndexedEntry(runtime, {
      title: "Campus Wellness Update",
      dept: "Design",
      type: "Notice",
      body: "This note mentions wellness activities for the semester.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "bu-001",
      tags: ["wellness"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "ask",
      text: "Explain the campus safety escalation process.",
      filters: EMPTY_FILTERS,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.mode).toBe("ask");
    expect(result.answer).toBeNull();
    expect(result.grounded).toBe(false);
    expect(result.enough_evidence).toBe(false);
    expect(result.results.length).toBeGreaterThanOrEqual(0);
    expect(result.follow_up_suggestions[0]).toMatch(/sources available to you/i);

    const telemetry = await getLatestRequestTelemetry(runtime);
    expect(telemetry?.outcome).toBe("no_answer");
    expect(telemetry?.failure_classification).toBe("none");
    expect(telemetry?.no_answer).toBe(true);
    expect(telemetry?.stage_timings.evidence_assessment_ms).toEqual(expect.any(Number));
  });

  it("records provider fallback telemetry when grounded answer generation fails", async () => {
    const runtime = await createTestRuntime({
      ASSISTANT_ANSWER_URL: "https://answers.test/v1/chat/completions",
    });
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await createIndexedEntry(runtime, {
      title: "Campus Safety Escalation Process",
      dept: "Administration",
      type: "Policy",
      body: "Campus safety escalation process requires immediate control room notification and dean approval.",
      priority: "High",
      entry_date: "2026-04-06",
      created_by: "ca-001",
      tags: ["safety", "escalation"],
      author_name: "Content Admin",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    const answeringModule = await import("../../rag/answering.js");
    vi.spyOn(answeringModule, "assessGroundedAnswerEvidence").mockImplementation((_question, evidence) => ({
      enoughEvidence: true,
      reason: "sufficient",
      evidence,
    }));
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Answer request timed out."));

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "ask",
      text: "Explain the campus safety escalation process.",
      filters: EMPTY_FILTERS,
    });

    expect(result.answer).toBeNull();
    expect(result.grounded).toBe(false);
    expect(result.enough_evidence).toBe(true);
    expect(result.follow_up_suggestions.join(" ")).toMatch(/temporarily unavailable/i);

    const telemetry = await getLatestRequestTelemetry(runtime);
    expect(telemetry?.outcome).toBe("provider_fallback");
    expect(telemetry?.failure_classification).toBe("provider_failure");
    expect(telemetry?.failure_subtype).toBe("answering_timeout");
    expect(telemetry?.provider_metadata.answering.status).toBe("degraded");
    expect(telemetry?.provider_metadata.answering.failure_subtype).toBe("answering_timeout");
  });

  it("abstains without calling the answer model when top evidence conflicts on a numeric answer", async () => {
    const runtime = await createTestRuntime({
      ASSISTANT_ANSWER_URL: "https://answers.test/v1/chat/completions",
    });
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    await createIndexedEntry(runtime, {
      title: "Program Atlas seat count update",
      dept: "Engineering",
      type: "Program update",
      body: "Program Atlas has 120 seats for the 2026 intake.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "ba-001",
      tags: ["atlas", "seats"],
      author_name: "Dr. Rajesh Kumar",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });
    await createIndexedEntry(runtime, {
      title: "Program Atlas seat count update",
      dept: "Engineering",
      type: "Program update",
      body: "Program Atlas has 180 seats for the 2026 intake.",
      priority: "Normal",
      entry_date: "2026-04-05",
      created_by: "ba-001",
      tags: ["atlas", "seats"],
      author_name: "Dr. Rajesh Kumar",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "ask",
      text: "How many seats does Program Atlas have?",
      filters: EMPTY_FILTERS,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.answer).toBeNull();
    expect(result.grounded).toBe(false);
    expect(result.enough_evidence).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.follow_up_suggestions.join(" ")).toMatch(/sources available to you/i);
  });

  it("abstains without calling the answer model when top evidence conflicts on a textual claim", async () => {
    const runtime = await createTestRuntime({
      ASSISTANT_ANSWER_URL: "https://answers.test/v1/chat/completions",
    });
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    await createIndexedEntry(runtime, {
      title: "Program Atlas delivery mode update",
      dept: "Engineering",
      type: "Program update",
      body: "Program Atlas will be delivered online for the 2026 intake.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "ba-001",
      tags: ["atlas", "delivery"],
      author_name: "Dr. Rajesh Kumar",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });
    await createIndexedEntry(runtime, {
      title: "Program Atlas delivery mode update",
      dept: "Engineering",
      type: "Program update",
      body: "Program Atlas will be delivered offline for the 2026 intake.",
      priority: "Normal",
      entry_date: "2026-04-05",
      created_by: "ba-001",
      tags: ["atlas", "delivery"],
      author_name: "Dr. Rajesh Kumar",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "ask",
      text: "Is Program Atlas online or offline for the 2026 intake?",
      filters: EMPTY_FILTERS,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.answer).toBeNull();
    expect(result.grounded).toBe(false);
    expect(result.enough_evidence).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.follow_up_suggestions.join(" ")).toMatch(/sources available to you/i);
  });

  it("keeps grounded ask citations and supporting results ACL-safe", async () => {
    const runtime = await createTestRuntime({
      ASSISTANT_ANSWER_URL: "https://answers.test/v1/chat/completions",
    });
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    const accessibleEntry = await createIndexedEntry(runtime, {
      title: "Brand Design Standards Update",
      dept: "Design",
      type: "Notice",
      body: "The brand design standards were updated with a verified accessibility review.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "bu-001",
      tags: ["brand", "standards"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });
    const blockedEntry = await createIndexedEntry(runtime, {
      title: "Hidden Design Standards Draft",
      dept: "Design",
      type: "Notice",
      body: "This hidden draft should never appear through answer citations or fallback guidance.",
      priority: "High",
      entry_date: "2026-04-06",
      created_by: "bu-001",
      tags: ["brand", "standards"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    await runtime.modules.db.pool.query(
      `UPDATE knowledge_assets
          SET visibility_scope = 'team',
              owner_team_id = 'branding',
              updated_at = NOW()
        WHERE id = $1`,
      [blockedEntry.asset.id],
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => buildAnswerProviderPayload([
        {
          text: "The accessible standards update confirms a verified accessibility review.",
          citations: ["S1"],
        },
      ]),
    } as Response);

    const contentActor = {
      authenticated: true as const,
      user_id: "cu-001",
      role: "user" as const,
      team_id: "content",
    };

    const result = await runtime.modules.service.executeAssistantQuery(contentActor, {
      mode: "ask",
      text: "Explain the design standards update.",
      filters: EMPTY_FILTERS,
    });

    expect(result.grounded).toBe(true);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.title).toBe(accessibleEntry.entry.title);
    expect(result.citations[0]?.source).toMatchObject({
      asset_id: accessibleEntry.asset.id,
      entry_id: accessibleEntry.entry.id,
      source_kind: "entry",
    });
    expect(result.citations[0]?.actions).toEqual({
      preview: { available: true },
      open_source: { available: true },
    });
    expect(result.results.map((item) => item.title)).toContain(accessibleEntry.entry.title);
    expect(result.results.map((item) => item.title)).not.toContain(blockedEntry.entry.title);
    expect(result.answer).not.toContain("Hidden Design Standards Draft");
    expect(result.follow_up_suggestions.join(" ")).not.toContain("Hidden Design Standards Draft");
  });

  it("records enqueue and success telemetry for reindex jobs", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    const entry = await runtime.modules.db.createEntry({
      title: "Telemetry Job Success",
      dept: "Design",
      type: "Notice",
      body: "Telemetry job success body.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "bu-001",
      tags: ["telemetry-job"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    const job = await runtime.modules.jobs.enqueueEntryReindex(entry.id);
    expect(job).toBeTruthy();

    await runtime.modules.jobs.processNextKnowledgeJob("test-rag-worker");

    const events = await listJobTelemetryEvents(runtime, job!.id);
    expect(events.map((event) => event.event_type)).toEqual(
      expect.arrayContaining(["enqueue", "claimed", "succeeded"]),
    );
  });

  it("records stale-lock recovery telemetry before reclaiming the job", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    const entry = await runtime.modules.db.createEntry({
      title: "Telemetry Stale Lock",
      dept: "Design",
      type: "Notice",
      body: "Telemetry stale lock body.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "bu-001",
      tags: ["stale-lock"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    const job = await runtime.modules.jobs.enqueueEntryReindex(entry.id);
    expect(job).toBeTruthy();

    await runtime.modules.db.pool.query(
      `UPDATE knowledge_jobs
          SET status = 'running',
              locked_at = NOW() - interval '2 hours',
              worker_id = 'stale-worker',
              attempt_count = 1
        WHERE id = $1`,
      [job!.id],
    );

    await runtime.modules.jobs.processNextKnowledgeJob("test-rag-worker");

    const events = await listJobTelemetryEvents(runtime, job!.id);
    expect(events.map((event) => event.event_type)).toContain("stale_lock_recovered");
  });

  it("keeps assistant responses intact when telemetry persistence fails open", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const originalQuery = runtime.modules.db.pool.query.bind(runtime.modules.db.pool);
    vi.spyOn(runtime.modules.db.pool, "query").mockImplementation(((text: unknown, ...args: unknown[]) => {
      if (typeof text === "string" && text.includes("INSERT INTO assistant_request_telemetry")) {
        return Promise.reject(new Error("Telemetry storage unavailable."));
      }

      return originalQuery(text as never, ...(args as []));
    }) as typeof runtime.modules.db.pool.query);

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "search",
      text: "Adobe Creative Suite",
      filters: EMPTY_FILTERS,
    });

    expect(result.results[0]?.title).toContain("Adobe");
  });

  it("applies department and inclusive date-range filters before shaping assistant results", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    await createIndexedEntry(runtime, {
      title: "Design Awards 2026",
      dept: "Design",
      type: "Achievement",
      body: "Adobe-aligned design showcase for Phase 1 filtering.",
      priority: "Normal",
      entry_date: "2026-01-10",
      created_by: "bu-001",
      tags: ["design-filter"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });
    await createIndexedEntry(runtime, {
      title: "Medical Awards 2026",
      dept: "Medical",
      type: "Achievement",
      body: "Accreditation-aligned medical showcase for Phase 1 filtering.",
      priority: "Normal",
      entry_date: "2026-01-10",
      created_by: "ca-001",
      tags: ["medical-filter"],
      author_name: "Content Admin",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });
    await createIndexedEntry(runtime, {
      title: "Design Awards 2025",
      dept: "Design",
      type: "Achievement",
      body: "Older design showcase that should fall outside the inclusive range.",
      priority: "Normal",
      entry_date: "2025-12-31",
      created_by: "bu-001",
      tags: ["design-older"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    const result = await runtime.modules.ragDb.searchEntryKnowledge({
      actor: SUPER_ADMIN_ACTOR,
      queryText: "showcase",
      filters: {
        department: "Design",
        date_range: {
          start: "2026-01-10",
          end: "2026-01-10",
        },
        sort: "relevance",
      },
      limit: 10,
    });

    expect(result.totalCount).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.title).toBe("Design Awards 2026");
  });

  it("supports newest sorting with malformed metadata dates degrading safely", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    const latest = await createIndexedEntry(runtime, {
      title: "Phase 1 Fresh Bulletin",
      dept: "Design",
      type: "Notice",
      body: "Fresh bulletin for newest sort validation.",
      priority: "Normal",
      entry_date: "2026-03-15",
      created_by: "bu-001",
      tags: ["newest-sort"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });
    const older = await createIndexedEntry(runtime, {
      title: "Phase 1 Older Bulletin",
      dept: "Design",
      type: "Notice",
      body: "Older bulletin for newest sort validation.",
      priority: "Normal",
      entry_date: "2026-01-15",
      created_by: "bu-001",
      tags: ["newest-sort"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });
    const malformed = await createIndexedEntry(runtime, {
      title: "Phase 1 Malformed Bulletin",
      dept: "Design",
      type: "Notice",
      body: "Malformed date metadata should not crash newest sorting.",
      priority: "Normal",
      entry_date: "2026-02-01",
      created_by: "bu-001",
      tags: ["newest-sort"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    await runtime.modules.db.pool.query(
      `UPDATE knowledge_assets
          SET metadata = jsonb_set(metadata, '{entry_date}', '"2026-99-99"'::jsonb)
        WHERE id = $1`,
      [malformed.asset.id],
    );

    const result = await runtime.modules.ragDb.searchEntryKnowledge({
      actor: SUPER_ADMIN_ACTOR,
      queryText: "bulletin",
      filters: {
        department: "Design",
        date_range: {
          start: null,
          end: null,
        },
        sort: "newest",
      },
      limit: 10,
    });

    expect(result.results.map((item) => item.title)).toEqual([
      "Phase 1 Fresh Bulletin",
      "Phase 1 Older Bulletin",
      "Phase 1 Malformed Bulletin",
    ]);
    expect(result.results[0]?.entry_id).toBe(latest.entry.id);
    expect(result.results[1]?.entry_id).toBe(older.entry.id);
  });

  it("keeps newest sorting and total counts authoritative beyond the relevance candidate cap", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    for (let day = 1; day <= 30; day += 1) {
      const entryDate = `2026-03-${String(day).padStart(2, "0")}`;
      const relevanceBody = day <= 24
        ? "bulletin ".repeat(20)
        : "bulletin ";

      await createIndexedEntry(runtime, {
        title: `Design Bulletin ${String(day).padStart(2, "0")}`,
        dept: "Design",
        type: "Notice",
        body: `${relevanceBody}Authoritative ordering should still prefer the newest entry date.`,
        priority: "Normal",
        entry_date: entryDate,
        created_by: "bu-001",
        tags: ["newest-cap"],
        author_name: "Branding User",
        academic_year: "2025-26",
        student_count: null,
        external_link: "",
        collaborating_org: "",
      });
    }

    const result = await runtime.modules.ragDb.searchEntryKnowledge({
      actor: SUPER_ADMIN_ACTOR,
      queryText: "bulletin",
      filters: {
        department: "Design",
        date_range: {
          start: null,
          end: null,
        },
        sort: "newest",
      },
      limit: 3,
    });

    expect(result.totalCount).toBe(30);
    expect(result.results).toHaveLength(3);
    expect(result.results.map((item) => item.title)).toEqual([
      "Design Bulletin 30",
      "Design Bulletin 29",
      "Design Bulletin 28",
    ]);
  });

  it("preserves no-results behavior when embeddings are enabled but the nearest chunk is not relevant enough", async () => {
    const runtime = await createTestRuntime({
      ASSISTANT_EMBEDDING_URL: "https://embeddings.test/v1/embeddings",
      ASSISTANT_EMBEDDING_MAX_QUERY_DISTANCE: "0.2",
    });
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    const remoteEntry = await createIndexedEntry(runtime, {
      title: "Project Orchard",
      dept: "Medical",
      type: "Notice",
      body: "Pebble harbor mint lantern.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "ca-001",
      tags: ["orchard"],
      author_name: "Content Admin",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    await setAssetEmbedding(runtime, remoteEntry.asset.id, buildEmbedding(1));

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: buildEmbedding(0) }],
      }),
    } as Response);

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "auto",
      text: "Summarize the starlight orchard policy memo.",
      filters: EMPTY_FILTERS,
    });

    expect(result.mode).toBe("ask");
    expect(result.results).toHaveLength(0);
  });

  it("degrades to lexical retrieval when the embedding provider times out", async () => {
    const runtime = await createTestRuntime({
      ASSISTANT_EMBEDDING_URL: "https://embeddings.test/v1/embeddings",
      ASSISTANT_EMBEDDING_TIMEOUT_MS: "5",
    });
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    vi.useFakeTimers();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => (
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener("abort", () => {
          const abortError = new Error("The operation was aborted.");
          abortError.name = "AbortError";
          reject(abortError);
        }, { once: true });
      })
    ));

    try {
      const resultPromise = runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
        mode: "search",
        text: "Adobe Creative Suite",
        filters: EMPTY_FILTERS,
      });

      await vi.advanceTimersByTimeAsync(10);
      const result = await resultPromise;

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.results[0]?.title).toContain("Adobe");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the assistant disabled path out of startup indexing and query execution", async () => {
    const runtime = await createTestRuntime({ ASSISTANT_RAG_ENABLED: "false" });
    cleanups.push(runtime.cleanup);

    const indexModule = await import("../../index.js");
    await indexModule.prepareApiRuntime();

    const tables = await runtime.modules.db.pool.query<{ table_name: string | null }>(
      `SELECT to_regclass('public.knowledge_assets')::text AS table_name`,
    );
    expect(tables.rows[0]?.table_name).toBeNull();

    const { server, baseUrl } = await startHttpServer(indexModule.app);

    try {
      const cookie = await loginAndGetSessionCookie(baseUrl);

      const healthResponse = await fetch(`${baseUrl}/api/assistant/health`, {
        headers: {
          Cookie: cookie,
        },
      });
      const healthPayload = await healthResponse.json() as {
        available: boolean;
        title: string;
      };

      expect(healthResponse.status).toBe(503);
      expect(healthPayload.available).toBe(false);
      expect(healthPayload.title).toContain("disabled");

      const createResponse = await fetch(`${baseUrl}/api/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          title: "Disabled-mode entry",
          dept: "Engineering",
          type: "Notice",
          body: "This entry should save without touching the assistant queue.",
          priority: "Normal",
          entry_date: "2026-04-05",
          created_by: null,
          tags: [],
          author_name: "",
          academic_year: "2025-26",
          student_count: null,
          external_link: "",
          collaborating_org: "",
        }),
      });

      expect(createResponse.status).toBe(201);

      const queryResponse = await fetch(`${baseUrl}/api/assistant/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          query: {
            mode: "search",
            text: "disabled mode",
            filters: EMPTY_FILTERS,
          },
        }),
      });
      const queryPayload = await queryResponse.json() as { message: string };

      expect(queryResponse.status).toBe(503);
      expect(queryPayload.message).toContain("disabled");
    } finally {
      await stopHttpServer(server);
    }
  });

  it("returns a created entry even when assistant queueing fails afterward", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    const indexModule = await import("../../index.js");
    await indexModule.prepareApiRuntime();
    await runtime.modules.db.pool.query(`DROP TABLE knowledge_jobs`);

    const { server, baseUrl } = await startHttpServer(indexModule.app);

    try {
      const cookie = await loginAndGetSessionCookie(baseUrl);
      const response = await fetch(`${baseUrl}/api/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          title: "Queue failure create",
          dept: "Engineering",
          type: "Notice",
          body: "The entry write should still succeed when queueing fails.",
          priority: "Normal",
          entry_date: "2026-04-05",
          created_by: null,
          tags: ["queue-failure"],
          author_name: "System Test",
          academic_year: "2025-26",
          student_count: null,
          external_link: "",
          collaborating_org: "",
        }),
      });

      const payload = await response.json() as {
        entry: {
          id: string;
          title: string;
        };
      };

      expect(response.status).toBe(201);
      expect(payload.entry.title).toBe("Queue failure create");

      const storedEntry = await runtime.modules.db.getEntryById(payload.entry.id);
      expect(storedEntry?.title).toBe("Queue failure create");
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });
    } finally {
      await stopHttpServer(server);
    }
  });

  it("returns an updated entry even when assistant queueing fails afterward", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    const indexModule = await import("../../index.js");
    await indexModule.prepareApiRuntime();
    const entry = (await runtime.modules.db.listEntries())[0];
    expect(entry).toBeTruthy();

    await runtime.modules.db.pool.query(`DROP TABLE knowledge_jobs`);

    const { server, baseUrl } = await startHttpServer(indexModule.app);

    try {
      const cookie = await loginAndGetSessionCookie(baseUrl);
      const response = await fetch(`${baseUrl}/api/entries/${entry!.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          priority: "High",
        }),
      });

      const payload = await response.json() as {
        entry: {
          id: string;
          priority: string;
        };
      };

      expect(response.status).toBe(200);
      expect(payload.entry.priority).toBe("High");

      const storedEntry = await runtime.modules.db.getEntryById(entry!.id);
      expect(storedEntry?.priority).toBe("High");
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });
    } finally {
      await stopHttpServer(server);
    }
  });

  it("launch-quality gate: evaluates the Phase 1 launch scenarios with telemetry-backed launch metrics", async () => {
    const runtime = await createTestRuntime({
      ASSISTANT_EMBEDDING_URL: "https://embeddings.test/v1/embeddings",
      ASSISTANT_ANSWER_URL: "https://answers.test/v1/chat/completions",
    });
    cleanups.push(runtime.cleanup);

    let serverBaseUrl: string | null = null;
    const originalFetch = globalThis.fetch.bind(globalThis);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (serverBaseUrl && url.startsWith(serverBaseUrl)) {
        return originalFetch(input, init);
      }

      if (url === "https://embeddings.test/v1/embeddings") {
        const body = typeof init?.body === "string"
          ? JSON.parse(init.body) as { input?: string[] | string }
          : {};
        const inputs = Array.isArray(body.input)
          ? body.input
          : typeof body.input === "string"
            ? [body.input]
            : [];

        return buildJsonResponse({
          data: inputs.map((text) => ({
            embedding: buildEmbedding(resolveMockEmbeddingIndex(text)),
          })),
        });
      }

      if (url === "https://answers.test/v1/chat/completions") {
        return buildJsonResponse(buildAnswerProviderPayload([
          {
            text: "The medical college has NABH accreditation for patient care, infrastructure, and clinical outcomes.",
            citations: ["S1"],
          },
        ]));
      }

      return originalFetch(input, init);
    });

    const indexModule = await import("../../index.js");
    await indexModule.prepareApiRuntime();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const semanticEntry = await createIndexedEntry(runtime, {
      title: "Project Aurora",
      dept: "Design",
      type: "Notice",
      body: "Lumen graph ember slate.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "bu-001",
      tags: ["aurora"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });
    const distractorEntry = await createIndexedEntry(runtime, {
      title: "Project Orchard",
      dept: "Medical",
      type: "Notice",
      body: "Pebble harbor mint lantern.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "ca-001",
      tags: ["orchard"],
      author_name: "Content Admin",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });
    await setAssetEmbedding(runtime, semanticEntry.asset.id, buildEmbedding(0));
    await setAssetEmbedding(runtime, distractorEntry.asset.id, buildEmbedding(1));

    await createIndexedEntry(runtime, {
      title: "Campus Wellness Update",
      dept: "Design",
      type: "Notice",
      body: "This note mentions wellness activities for the semester.",
      priority: "Normal",
      entry_date: "2026-04-06",
      created_by: "bu-001",
      tags: ["wellness"],
      author_name: "Branding User",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    const explicitEntry = await createIndexedEntry(runtime, {
      title: "Explicit ACL Story 1.8 Q9VX Result",
      dept: "Sciences",
      type: "Notice",
      body: "Explicit ACL story 1.8 q9vx result body for launch guardrail validation.",
      priority: "High",
      entry_date: "2026-04-06",
      created_by: "ca-001",
      tags: ["explicit-acl", "launch-quality", "q9vx-acl-token"],
      author_name: "Content Admin",
      academic_year: "2025-26",
      student_count: null,
      external_link: "",
      collaborating_org: "",
    });

    await runtime.modules.db.pool.query(
      `UPDATE knowledge_assets
          SET visibility_scope = 'explicit_acl',
              owner_team_id = 'content',
              updated_at = NOW()
        WHERE id = $1`,
      [explicitEntry.asset.id],
    );
    await runtime.modules.db.pool.query(
      `INSERT INTO knowledge_acl_principals (id, asset_id, principal_type, principal_id, permission)
       VALUES ($1, $2, 'team', 'content', 'read')`,
      [`acl-${explicitEntry.asset.id}`, explicitEntry.asset.id],
    );

    const sourceReference = await getSourceReference(runtime, explicitEntry.asset.id, explicitEntry.entry.id);
    const { server, baseUrl } = await startHttpServer(indexModule.app);
    serverBaseUrl = baseUrl;

    try {
      const superAdminCookie = await loginAndGetSessionCookie(baseUrl);
      const brandingCookie = await loginAndGetSessionCookie(baseUrl, {
        email: "brand-user@parul.ac.in",
        password: "branduser123",
      });
      const contentCookie = await loginAndGetSessionCookie(baseUrl, {
        email: "content-user@parul.ac.in",
        password: "contentuser123",
      });

      const exactMatch = await postJson<{
        result: {
          total_results: number;
          results: Array<{ title: string }>;
          request_id: string;
        };
      }>(
        baseUrl,
        "/api/assistant/query",
        superAdminCookie,
        {
          query: {
            mode: "search",
            text: "NABH accreditation",
            filters: {
              departments: [],
              entry_types: [],
              priorities: [],
              tags: [],
            },
          },
        },
      );

      expect(exactMatch.response.ok).toBe(true);
      expect(exactMatch.payload.result.total_results).toBeGreaterThan(0);
      expect(
        exactMatch.payload.result.results.slice(0, 5).some((result) => result.title.includes("NABH")),
      ).toBe(true);

      const groundedAsk = await postJson<{
        result: {
          grounded: boolean;
          enough_evidence: boolean;
          answer: string | null;
          citations: Array<{ label: string; title: string }>;
          results: Array<{ title: string }>;
          request_id: string;
        };
      }>(
        baseUrl,
        "/api/assistant/query",
        superAdminCookie,
        {
          query: {
            mode: "ask",
            text: "Summarize what Nerve says about NABH accreditation.",
            filters: {
              departments: [],
              entry_types: [],
              priorities: [],
              tags: [],
            },
          },
        },
      );

      expect(groundedAsk.response.ok).toBe(true);
      expect(groundedAsk.payload.result.grounded).toBe(true);
      expect(groundedAsk.payload.result.enough_evidence).toBe(true);
      expect(groundedAsk.payload.result.answer).toContain("[S1]");
      expect(groundedAsk.payload.result.citations).toHaveLength(1);
      expect(groundedAsk.payload.result.results.length).toBeGreaterThan(0);

      const semanticSearch = await postJson<{
        result: {
          results: Array<{ title: string }>;
          request_id: string;
        };
      }>(
        baseUrl,
        "/api/assistant/query",
        superAdminCookie,
        {
          query: {
            mode: "search",
            text: "semantic-aurora-intent",
            filters: {
              departments: [],
              entry_types: [],
              priorities: [],
              tags: [],
            },
          },
        },
      );

      expect(semanticSearch.response.ok).toBe(true);
      expect(semanticSearch.payload.result.results[0]?.title).toBe("Project Aurora");

      const noAnswer = await postJson<{
        result: {
          grounded: boolean;
          enough_evidence: boolean;
          answer: string | null;
          follow_up_suggestions: string[];
          request_id: string;
        };
      }>(
        baseUrl,
        "/api/assistant/query",
        superAdminCookie,
        {
          query: {
            mode: "ask",
            text: "Explain the campus safety escalation process.",
            filters: {
              departments: [],
              entry_types: [],
              priorities: [],
              tags: [],
            },
          },
        },
      );

      expect(noAnswer.response.ok).toBe(true);
      expect(noAnswer.payload.result.answer).toBeNull();
      expect(noAnswer.payload.result.grounded).toBe(false);
      expect(noAnswer.payload.result.enough_evidence).toBe(false);
      expect(noAnswer.payload.result.follow_up_suggestions[0]).toMatch(/sources available to you/i);

      const blockedQuery = await postJson<{
        result: {
          results: Array<{ title: string }>;
          citations: Array<{ title: string }>;
          request_id: string;
        };
      }>(
        baseUrl,
        "/api/assistant/query",
        brandingCookie,
        {
          query: {
            mode: "search",
            text: "q9vx-acl-token",
            filters: {
              departments: [],
              entry_types: [],
              priorities: [],
              tags: [],
            },
          },
        },
      );

      expect(blockedQuery.response.ok).toBe(true);
      expect(
        blockedQuery.payload.result.results.some((result) => result.title.includes("Explicit ACL Story 1.8 Q9VX Result")),
      ).toBe(false);
      expect(
        blockedQuery.payload.result.citations.some((citation) => citation.title.includes("Explicit ACL Story 1.8 Q9VX Result")),
      ).toBe(false);

      const blockedPreview = await postJson<{ message: string }>(
        baseUrl,
        "/api/assistant/source-preview",
        brandingCookie,
        {
          preview: {
            source: sourceReference,
          },
        },
      );

      expect(blockedPreview.response.status).toBe(403);
      expect(blockedPreview.payload.message).toBe("You are not authorized to access that source.");
      expect(JSON.stringify(blockedPreview.payload)).not.toContain("Explicit ACL Story 1.8 Q9VX Result");

      const blockedOpen = await postJson<{ message: string }>(
        baseUrl,
        "/api/assistant/source-open",
        brandingCookie,
        {
          open: {
            source: sourceReference,
          },
        },
      );

      expect(blockedOpen.response.status).toBe(403);
      expect(blockedOpen.payload.message).toBe("You are not authorized to access that source.");
      expect(JSON.stringify(blockedOpen.payload)).not.toContain("Explicit ACL Story 1.8 Q9VX Result");

      const allowedPreview = await postJson<{
        preview: {
          title: string;
          excerpt: string;
          open_target: { path: string };
        };
      }>(
        baseUrl,
        "/api/assistant/source-preview",
        contentCookie,
        {
          preview: {
            source: sourceReference,
          },
        },
      );

      expect(allowedPreview.response.ok).toBe(true);
      expect(allowedPreview.payload.preview.title).toContain("Explicit ACL Story 1.8 Q9VX Result");
      expect(allowedPreview.payload.preview.excerpt).toContain("launch guardrail validation");

      const allowedOpen = await postJson<{
        open: {
          target: { path: string };
        };
      }>(
        baseUrl,
        "/api/assistant/source-open",
        contentCookie,
        {
          open: {
            source: sourceReference,
          },
        },
      );

      expect(allowedOpen.response.ok).toBe(true);
      expect(allowedOpen.payload.open.target.path).toContain("/browse/source?");

      const launchSummary = await runtime.modules.metrics.getAssistantLaunchSummary();
      expect(launchSummary.action_counts.query_request_count).toBe(5);
      expect(launchSummary.action_counts.source_preview_request_count).toBe(2);
      expect(launchSummary.action_counts.source_open_request_count).toBe(2);
      expect(launchSummary.action_counts.denied_source_request_count).toBe(2);
      expect(launchSummary.request_mix.search_request_count).toBe(3);
      expect(launchSummary.request_mix.ask_request_count).toBe(2);
      expect(launchSummary.quality_metrics.citation_coverage_rate).toBe(1);
      expect(launchSummary.quality_metrics.no_answer_rate).toBe(0.5);
      expect(launchSummary.latency.search.sample_count).toBe(3);
      expect(launchSummary.latency.ask.sample_count).toBe(2);
      expect(launchSummary.outcome_counts.grounded_answer_count).toBe(1);
      expect(launchSummary.outcome_counts.no_answer_count).toBe(1);
      expect(launchSummary.outcome_counts.permission_denied_count).toBe(2);
      expect(launchSummary.outcome_counts.request_failed_count).toBe(0);

      const evaluation = buildLaunchEvaluationSummary(launchSummary, [
        {
          category: "exact-match search",
          passed: exactMatch.payload.result.results.slice(0, 5).some((result) => result.title.includes("NABH")),
          blocker: "Exact-match launch evaluation did not keep the intended entry inside the top five results.",
        },
        {
          category: "grounded answer citations",
          passed: groundedAsk.payload.result.grounded
            && groundedAsk.payload.result.answer?.includes("[S1]") === true
            && groundedAsk.payload.result.citations.length > 0,
          blocker: "Grounded-answer launch evaluation detected a substantive answer without citation coverage.",
        },
        {
          category: "semantic retrieval",
          passed: semanticSearch.payload.result.results[0]?.title === "Project Aurora",
          blocker: "Semantic launch evaluation failed to retrieve the intended entry when wording diverged.",
        },
        {
          category: "no-answer abstention",
          passed: noAnswer.payload.result.answer === null
            && !noAnswer.payload.result.grounded
            && !noAnswer.payload.result.enough_evidence,
          blocker: "No-answer launch evaluation produced unsupported narrative content instead of abstaining.",
        },
        {
          category: "ACL-sensitive flows",
          passed: !blockedQuery.payload.result.results.some((result) => (
            result.title.includes("Explicit ACL Story 1.8 Q9VX Result")
          ))
            && !blockedQuery.payload.result.citations.some((citation) => (
              citation.title.includes("Explicit ACL Story 1.8 Q9VX Result")
            ))
            && blockedPreview.response.status === 403
            && blockedOpen.response.status === 403
            && !JSON.stringify(blockedPreview.payload).includes("Explicit ACL Story 1.8 Q9VX Result")
            && !JSON.stringify(blockedOpen.payload).includes("Explicit ACL Story 1.8 Q9VX Result")
            && allowedPreview.response.ok
            && allowedOpen.response.ok,
          blocker: "ACL-sensitive launch evaluation detected blocked-source leakage or an unexpected permission bypass.",
        },
      ]);

      expect(evaluation.launch_ready).toBe(true);
      expect(evaluation.blockers).toEqual([]);
    } finally {
      await stopHttpServer(server);
    }
  });

  it("launch-quality gate: summarizes citation coverage, request mix, and p95 timing slices deterministically", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();

    const requestIds = [
      "launch-search-1",
      "launch-search-2",
      "launch-ask-1",
      "launch-ask-2",
      "launch-ask-3",
      "launch-preview-1",
    ];
    const filterSummary = {
      department: null,
      sort: "relevance" as const,
      has_date_start: false,
      has_date_end: false,
    };

    await runtime.modules.metrics.recordAssistantRequestTelemetry({
      requestId: requestIds[0]!,
      action: "query",
      actor: SUPER_ADMIN_ACTOR,
      requestedMode: "search",
      resolvedMode: "search",
      authorizationOutcome: "allowed",
      outcome: "search_results",
      failureClassification: "none",
      failureSubtype: null,
      grounded: false,
      enoughEvidence: true,
      noAnswer: false,
      resultCount: 3,
      citationCount: 0,
      filterSummary,
      stageTimings: { total_ms: 1500 },
      providerMetadata: runtime.modules.metrics.defaultProviderMetadata(),
      metadata: {},
    });
    await runtime.modules.metrics.recordAssistantRequestTelemetry({
      requestId: requestIds[1]!,
      action: "query",
      actor: SUPER_ADMIN_ACTOR,
      requestedMode: "search",
      resolvedMode: "search",
      authorizationOutcome: "allowed",
      outcome: "search_results",
      failureClassification: "none",
      failureSubtype: null,
      grounded: false,
      enoughEvidence: true,
      noAnswer: false,
      resultCount: 2,
      citationCount: 0,
      filterSummary,
      stageTimings: { total_ms: 2600 },
      providerMetadata: runtime.modules.metrics.defaultProviderMetadata(),
      metadata: {},
    });
    await runtime.modules.metrics.recordAssistantRequestTelemetry({
      requestId: requestIds[2]!,
      action: "query",
      actor: SUPER_ADMIN_ACTOR,
      requestedMode: "ask",
      resolvedMode: "ask",
      authorizationOutcome: "allowed",
      outcome: "grounded_answer",
      failureClassification: "none",
      failureSubtype: null,
      grounded: true,
      enoughEvidence: true,
      noAnswer: false,
      resultCount: 1,
      citationCount: 1,
      filterSummary,
      stageTimings: { total_ms: 7000 },
      providerMetadata: runtime.modules.metrics.defaultProviderMetadata(),
      metadata: {},
    });
    await runtime.modules.metrics.recordAssistantRequestTelemetry({
      requestId: requestIds[3]!,
      action: "query",
      actor: SUPER_ADMIN_ACTOR,
      requestedMode: "ask",
      resolvedMode: "ask",
      authorizationOutcome: "allowed",
      outcome: "grounded_answer",
      failureClassification: "none",
      failureSubtype: null,
      grounded: true,
      enoughEvidence: true,
      noAnswer: false,
      resultCount: 1,
      citationCount: 0,
      filterSummary,
      stageTimings: { total_ms: 8100 },
      providerMetadata: runtime.modules.metrics.defaultProviderMetadata(),
      metadata: {},
    });
    await runtime.modules.metrics.recordAssistantRequestTelemetry({
      requestId: requestIds[4]!,
      action: "query",
      actor: SUPER_ADMIN_ACTOR,
      requestedMode: "ask",
      resolvedMode: "ask",
      authorizationOutcome: "allowed",
      outcome: "no_answer",
      failureClassification: "none",
      failureSubtype: null,
      grounded: false,
      enoughEvidence: false,
      noAnswer: true,
      resultCount: 0,
      citationCount: 0,
      filterSummary,
      stageTimings: { total_ms: 9000 },
      providerMetadata: runtime.modules.metrics.defaultProviderMetadata(),
      metadata: {},
    });
    await runtime.modules.metrics.recordAssistantRequestTelemetry({
      requestId: requestIds[5]!,
      action: "source-preview",
      actor: SUPER_ADMIN_ACTOR,
      requestedMode: null,
      resolvedMode: null,
      authorizationOutcome: "denied",
      outcome: "permission_denied",
      failureClassification: "permission_failure",
      failureSubtype: "source_preview_denied",
      grounded: false,
      enoughEvidence: false,
      noAnswer: false,
      resultCount: 0,
      citationCount: 0,
      filterSummary: null,
      stageTimings: { total_ms: 50 },
      providerMetadata: runtime.modules.metrics.defaultProviderMetadata(),
      metadata: {},
    });

    const summary = await runtime.modules.metrics.getAssistantLaunchSummary({ requestIds });

    expect(summary.request_ids).toEqual(requestIds);
    expect(summary.action_counts.total_request_count).toBe(6);
    expect(summary.action_counts.query_request_count).toBe(5);
    expect(summary.action_counts.source_preview_request_count).toBe(1);
    expect(summary.action_counts.denied_source_request_count).toBe(1);
    expect(summary.request_mix.search_request_count).toBe(2);
    expect(summary.request_mix.ask_request_count).toBe(3);
    expect(summary.request_mix.search_share).toBe(0.4);
    expect(summary.request_mix.ask_share).toBe(0.6);
    expect(summary.quality_metrics.citation_coverage_rate).toBe(0.5);
    expect(summary.quality_metrics.grounded_answer_with_citations_count).toBe(1);
    expect(summary.quality_metrics.no_answer_rate).toBe(0.3333);
    expect(summary.latency.search.p95_ms).toBe(2600);
    expect(summary.latency.search.within_target).toBe(false);
    expect(summary.latency.ask.p95_ms).toBe(9000);
    expect(summary.latency.ask.within_target).toBe(false);
    expect(summary.outcome_counts.search_results_count).toBe(2);
    expect(summary.outcome_counts.grounded_answer_count).toBe(2);
    expect(summary.outcome_counts.no_answer_count).toBe(1);
    expect(summary.outcome_counts.permission_denied_count).toBe(1);
    expect(summary.outcome_counts.request_failed_count).toBe(0);

    const evaluation = buildLaunchEvaluationSummary(summary, [
      {
        category: "exact-match search",
        passed: true,
        blocker: "Exact-match launch evaluation did not keep the intended entry inside the top five results.",
      },
      {
        category: "grounded answer citations",
        passed: true,
        blocker: "Grounded-answer launch evaluation detected a substantive answer without citation coverage.",
      },
    ]);

    expect(evaluation.launch_ready).toBe(false);
    expect(evaluation.blockers).toContain(
      "Launch telemetry summary shows search p95 latency 2600 ms above target 2500 ms.",
    );
    expect(evaluation.blockers).toContain(
      "Launch telemetry summary shows ask p95 latency 9000 ms above target 8000 ms.",
    );
  });

  it("removes deleted entries from assistant search results", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    const indexModule = await import("../../index.js");
    await indexModule.prepareApiRuntime();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const adobeEntry = (await runtime.modules.db.listEntries()).find((entry) => entry.title.includes("Adobe"));
    expect(adobeEntry).toBeTruthy();

    const { server, baseUrl } = await startHttpServer(indexModule.app);

    try {
      const cookie = await loginAndGetSessionCookie(baseUrl);
      const deleteResponse = await fetch(`${baseUrl}/api/entries/${adobeEntry!.id}`, {
        method: "DELETE",
        headers: {
          Cookie: cookie,
        },
      });

      expect(deleteResponse.status).toBe(200);

      const searchResults = await runtime.modules.ragDb.searchEntryKnowledge({
        actor: SUPER_ADMIN_ACTOR,
        queryText: "Adobe Creative Suite",
        filters: EMPTY_FILTERS,
        limit: 5,
      });

      expect(searchResults.results.some((result) => result.entry_id === adobeEntry!.id)).toBe(false);
    } finally {
      await stopHttpServer(server);
    }
  });

  it("rejects embedding dimensions that do not match the fixed vector schema", async () => {
    const envKeys = [
      "DATABASE_URL",
      "SESSION_SECRET",
      "SUPER_ADMIN_PASSWORD",
      "ASSISTANT_EMBEDDING_DIMENSIONS",
    ] as const;
    const previousEnv = new Map<string, string | undefined>();

    for (const key of envKeys) {
      previousEnv.set(key, process.env[key]);
    }

    try {
      vi.resetModules();
      Object.assign(process.env, {
        DATABASE_URL: "postgres://nerve_app:test@127.0.0.1:5432/nerve",
        SESSION_SECRET: "test-session-secret",
        SUPER_ADMIN_PASSWORD: "Test-Password-123!",
        ASSISTANT_EMBEDDING_DIMENSIONS: "1024",
      });

      await expect(import("../../config.js")).rejects.toThrow(
        "ASSISTANT_EMBEDDING_DIMENSIONS must be 1536",
      );
    } finally {
      for (const key of envKeys) {
        const previousValue = previousEnv.get(key);
        if (previousValue === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previousValue;
        }
      }
      vi.resetModules();
    }
  });
});
