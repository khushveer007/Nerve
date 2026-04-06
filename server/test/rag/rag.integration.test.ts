import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreateEntryInput } from "../../db.js";
import {
  createTestRuntime,
  drainKnowledgeJobs,
  loginAndGetSessionCookie,
  startHttpServer,
  stopHttpServer,
} from "./test-utils.js";

const cleanups: Array<() => Promise<void>> = [];
const EMPTY_FILTERS = {
  departments: [],
  entry_types: [],
  priorities: [],
  tags: [],
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
  runtime: Awaited<ReturnType<typeof createTestRuntime>>,
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
  runtime: Awaited<ReturnType<typeof createTestRuntime>>,
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
  runtime: Awaited<ReturnType<typeof createTestRuntime>>,
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
      actor: SUPER_ADMIN_ACTOR,
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
      actor: SUPER_ADMIN_ACTOR,
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
      actor: SUPER_ADMIN_ACTOR,
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
          citations: Array<{ title: string }>;
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
          citations: Array<{ title: string }>;
        };
      };

      expect(allowedResponse.ok).toBe(true);
      expect(allowedPayload.result.results).toHaveLength(1);
      expect(allowedPayload.result.results[0]?.title).toContain("Team Scope Story 1.3 Result");
      expect(allowedPayload.result.results[0]?.snippet).toContain("ACL validation");
      expect(allowedPayload.result.citations).toHaveLength(1);
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
      expect(allowedPreviewPayload.preview.open_target.path).toContain("/browse?");
    } finally {
      await stopHttpServer(server);
    }
  });

  it("routes clear synthesis-style auto queries to ask mode without fabricating answer text", async () => {
    const runtime = await createTestRuntime();
    cleanups.push(runtime.cleanup);

    await runtime.modules.db.bootstrapDatabase();
    await runtime.modules.ragDb.runRagMigrations();
    await runtime.modules.jobs.enqueueEntryBackfill();
    await drainKnowledgeJobs(runtime.modules.jobs);

    const result = await runtime.modules.service.executeAssistantQuery(SUPER_ADMIN_ACTOR, {
      mode: "auto",
      text: "Summarize what Nerve says about NABH accreditation.",
      filters: EMPTY_FILTERS,
    });

    expect(result.mode).toBe("ask");
    expect(result.answer).toBeNull();
    expect(result.grounded).toBe(false);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.follow_up_suggestions[0]).toMatch(/grounded answer synthesis/i);
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
    expect(result.results.some((item) => item.title === "Project Orchard")).toBe(true);
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
        actor: SUPER_ADMIN_ACTOR,
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
