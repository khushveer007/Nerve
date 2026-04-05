import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTestRuntime,
  drainKnowledgeJobs,
  loginAndGetSessionCookie,
  startHttpServer,
  stopHttpServer,
} from "./test-utils.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    if (cleanup) {
      await cleanup();
    }
  }
});

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

    expect(await runtime.modules.ragDb.getRagMigrationCount()).toBe(3);

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
      queryText: "Adobe Creative Suite",
      filters: {
        departments: [],
        entry_types: [],
        priorities: [],
        tags: [],
      },
      limit: 5,
    });

    expect(searchResults[0]?.entry_id).toBe(entry!.id);
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
      queryText: "Firefly training labs",
      filters: {
        departments: [],
        entry_types: [],
        priorities: [],
        tags: [],
      },
      limit: 5,
    });

    expect(searchResults[0]?.title).toContain("Adobe");
    expect(searchResults[0]?.snippet).toContain("Firefly training labs");
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
      queryText: "Adobe Creative Suite",
      filters: {
        departments: [],
        entry_types: [],
        priorities: [],
        tags: [],
      },
      limit: 5,
    });

    expect(searchResults[0]?.entry_id).toBe(entry!.id);
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

    await runtime.modules.ragDb.enqueueReindexJob("asset-missing-entry", "entry-does-not-exist");
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
            filters: {
              departments: [],
              entry_types: [],
              priorities: [],
              tags: [],
            },
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
        queryText: "Adobe Creative Suite",
        filters: {
          departments: [],
          entry_types: [],
          priorities: [],
          tags: [],
        },
        limit: 5,
      });

      expect(searchResults.some((result) => result.entry_id === adobeEntry!.id)).toBe(false);
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
