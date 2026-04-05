import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { pool, type Entry } from "../db.js";
import type {
  AssistantEntrySearchResult,
  AssistantHealthSnapshot,
  AssistantQueryFilters,
  CitationLocator,
  EntryChunkDocument,
  EntryKnowledgeMetadata,
  KnowledgeAssetRecord,
  KnowledgeAssetStatus,
  KnowledgeAssetVersionRecord,
  KnowledgeJobRecord,
  KnowledgeJobStatus,
} from "./types.js";

const RAG_MIGRATION_LOCK_KEY = 421_947_835;

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function mapKnowledgeAsset(row: {
  id: string;
  source_kind: string;
  source_table: string;
  source_id: string;
  title: string;
  status: KnowledgeAssetStatus;
  visibility_scope: KnowledgeAssetRecord["visibility_scope"];
  metadata: EntryKnowledgeMetadata;
}): KnowledgeAssetRecord {
  return {
    id: row.id,
    source_kind: row.source_kind,
    source_table: row.source_table,
    source_id: row.source_id,
    title: row.title,
    status: row.status,
    visibility_scope: row.visibility_scope,
    metadata: row.metadata,
  };
}

function mapKnowledgeJob(row: KnowledgeJobRecord) {
  return {
    ...row,
    payload: (row.payload ?? {}) as Record<string, unknown>,
  };
}

function mapSearchResult(row: {
  asset_id: string;
  asset_version_id: string;
  chunk_id: string;
  entry_id: string;
  title: string;
  snippet: string;
  score: number | string;
  metadata: EntryKnowledgeMetadata;
  citation_locator: CitationLocator;
}): AssistantEntrySearchResult {
  return {
    asset_id: row.asset_id,
    asset_version_id: row.asset_version_id,
    chunk_id: row.chunk_id,
    entry_id: row.entry_id,
    title: row.title,
    source_kind: "entry",
    media_type: "text",
    snippet: row.snippet,
    score: Number(row.score),
    metadata: row.metadata,
    citation_locator: row.citation_locator,
  };
}

function buildEntryAssetMetadata(entry: Entry): EntryKnowledgeMetadata {
  return {
    source_kind: "entry",
    entry_id: entry.id,
    dept: entry.dept,
    type: entry.type,
    tags: entry.tags,
    entry_date: entry.entry_date,
    academic_year: entry.academic_year,
    author_name: entry.author_name,
    created_by: entry.created_by,
    priority: entry.priority,
    student_count: entry.student_count,
    external_link: entry.external_link,
    collaborating_org: entry.collaborating_org,
  };
}

function buildChunkMetadataText(metadata: Record<string, unknown>) {
  return Object.values(metadata)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(" ");
}

function buildMigrationTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS rag_schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function runRagMigrations() {
  const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const migrationFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [RAG_MIGRATION_LOCK_KEY]);
    await client.query(buildMigrationTableSql());

    for (const migrationFile of migrationFiles) {
      await client.query("BEGIN");
      try {
        const alreadyApplied = await client.query<{ exists: boolean }>(
          `SELECT EXISTS(SELECT 1 FROM rag_schema_migrations WHERE name = $1) AS exists`,
          [migrationFile],
        );

        if (!alreadyApplied.rows[0]?.exists) {
          const sql = await fs.readFile(path.join(migrationsDir, migrationFile), "utf8");
          await client.query(sql);
          await client.query(
            `INSERT INTO rag_schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
            [migrationFile],
          );
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    try {
      await client.query(`SELECT pg_advisory_unlock($1)`, [RAG_MIGRATION_LOCK_KEY]);
    } catch {
      // Connection teardown also releases the lock, so unlock failures are non-fatal.
    }
    client.release();
  }
}

export async function getRagMigrationCount() {
  const result = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM rag_schema_migrations`,
  );
  return result.rows[0]?.count ?? 0;
}

export async function getAssistantHealthSnapshot(): Promise<AssistantHealthSnapshot> {
  const result = await pool.query<AssistantHealthSnapshot>(`
    SELECT
      (SELECT COUNT(*)::int FROM knowledge_assets WHERE status = 'ready') AS ready_assets,
      (SELECT COUNT(*)::int FROM knowledge_jobs WHERE status = 'queued') AS queued_jobs,
      (SELECT COUNT(*)::int FROM knowledge_jobs WHERE status = 'running') AS running_jobs
  `);

  return result.rows[0] ?? {
    ready_assets: 0,
    queued_jobs: 0,
    running_jobs: 0,
  };
}

export async function upsertEntryKnowledgeAsset(entry: Entry) {
  const metadata = buildEntryAssetMetadata(entry);
  const result = await pool.query<{
    id: string;
    source_kind: string;
    source_table: string;
    source_id: string;
    title: string;
    status: KnowledgeAssetStatus;
    visibility_scope: KnowledgeAssetRecord["visibility_scope"];
    metadata: EntryKnowledgeMetadata;
  }>(
    `INSERT INTO knowledge_assets (
      id,
      source_kind,
      source_table,
      source_id,
      title,
      mime_type,
      media_type,
      storage_backend,
      sha256,
      size_bytes,
      owner_user_id,
      visibility_scope,
      status,
      created_by,
      metadata
    ) VALUES (
      $1,
      'entry',
      'entries',
      $2,
      $3,
      'text/markdown',
      'text',
      'database',
      '',
      $4,
      $5,
      'authenticated',
      'pending',
      $5,
      $6::jsonb
    )
    ON CONFLICT (source_table, source_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      mime_type = EXCLUDED.mime_type,
      media_type = EXCLUDED.media_type,
      sha256 = knowledge_assets.sha256,
      size_bytes = EXCLUDED.size_bytes,
      owner_user_id = EXCLUDED.owner_user_id,
      visibility_scope = EXCLUDED.visibility_scope,
      status = knowledge_assets.status,
      created_by = EXCLUDED.created_by,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING id, source_kind, source_table, source_id, title, status, visibility_scope, metadata`,
    [
      generateId("asset"),
      entry.id,
      entry.title,
      Buffer.byteLength(entry.body, "utf8"),
      entry.created_by,
      JSON.stringify(metadata),
    ],
  );

  return mapKnowledgeAsset(result.rows[0]);
}

export async function getKnowledgeAssetBySourceId(sourceId: string) {
  const result = await pool.query<{
    id: string;
    source_kind: string;
    source_table: string;
    source_id: string;
    title: string;
    status: KnowledgeAssetStatus;
    visibility_scope: KnowledgeAssetRecord["visibility_scope"];
    metadata: EntryKnowledgeMetadata;
  }>(
    `SELECT id, source_kind, source_table, source_id, title, status, visibility_scope, metadata
       FROM knowledge_assets
      WHERE source_table = 'entries' AND source_id = $1
      LIMIT 1`,
    [sourceId],
  );

  return result.rows[0] ? mapKnowledgeAsset(result.rows[0]) : null;
}

export async function getCurrentKnowledgeAssetVersion(assetId: string) {
  const result = await pool.query<KnowledgeAssetVersionRecord>(
    `SELECT id, asset_id, version_no, source_hash, extraction_status, superseded_at
       FROM knowledge_asset_versions
      WHERE asset_id = $1
        AND superseded_at IS NULL
      ORDER BY version_no DESC
      LIMIT 1`,
    [assetId],
  );

  return result.rows[0] ?? null;
}

export async function updateKnowledgeAssetStatus(assetId: string, status: KnowledgeAssetStatus) {
  await pool.query(
    `UPDATE knowledge_assets
        SET status = $2,
            updated_at = NOW()
      WHERE id = $1`,
    [assetId, status],
  );
}

export async function storeIndexedEntryVersion(input: {
  asset: KnowledgeAssetRecord;
  document: EntryChunkDocument;
  embeddings: Array<string | null>;
  extractorModel: string;
}) {
  return withTransaction(async (client) => {
    const latestResult = await client.query<KnowledgeAssetVersionRecord>(
      `SELECT id, asset_id, version_no, source_hash, extraction_status, superseded_at
         FROM knowledge_asset_versions
        WHERE asset_id = $1
          AND superseded_at IS NULL
        ORDER BY version_no DESC
        LIMIT 1
        FOR UPDATE`,
      [input.asset.id],
    );

    const latest = latestResult.rows[0];
    if (latest && latest.source_hash === input.document.source_hash) {
      await client.query(
        `UPDATE knowledge_assets
            SET status = 'ready',
                sha256 = $2,
                size_bytes = $3,
                metadata = $4::jsonb,
                updated_at = NOW()
          WHERE id = $1`,
        [
          input.asset.id,
          input.document.source_hash,
          Buffer.byteLength(input.document.normalized_text, "utf8"),
          JSON.stringify(input.document.metadata),
        ],
      );

      return {
        changed: false,
        version_id: latest.id,
        version_no: latest.version_no,
      };
    }

    const nextVersionNo = (latest?.version_no ?? 0) + 1;
    const versionId = generateId("assetver");

    await client.query(
      `INSERT INTO knowledge_asset_versions (
        id,
        asset_id,
        version_no,
        source_hash,
        extractor_model,
        extraction_status,
        normalized_markdown,
        normalized_text,
        page_count,
        language_code,
        structural_metadata
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        'processing',
        $6,
        $7,
        NULL,
        'en',
        $8::jsonb
      )`,
      [
        versionId,
        input.asset.id,
        nextVersionNo,
        input.document.source_hash,
        input.extractorModel,
        input.document.normalized_markdown,
        input.document.normalized_text,
        JSON.stringify(input.document.structural_metadata),
      ],
    );

    await client.query(
      `UPDATE knowledge_assets
          SET status = 'processing',
              updated_at = NOW()
        WHERE id = $1`,
      [input.asset.id],
    );

    for (const [index, chunk] of input.document.chunks.entries()) {
      const chunkId = generateId("chunk");
      const citationLocator = {
        ...chunk.citation_locator,
        asset_id: input.asset.id,
        asset_version_id: versionId,
        chunk_id: chunkId,
        title: input.asset.title,
      };

      await client.query(
        `INSERT INTO knowledge_chunks (
          id,
          asset_version_id,
          asset_id,
          chunk_no,
          chunk_type,
          heading_path,
          page_from,
          page_to,
          char_start,
          char_end,
          token_count,
          content,
          search_vector,
          embedding,
          metadata,
          citation_locator
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::text[],
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          setweight(to_tsvector('english', coalesce($13, '')), 'A')
          || setweight(to_tsvector('english', coalesce($14, '')), 'B')
          || setweight(to_tsvector('english', coalesce($12, '')), 'C'),
          $15::vector,
          $16::jsonb,
          $17::jsonb
        )`,
        [
          chunkId,
          versionId,
          input.asset.id,
          chunk.chunk_no,
          chunk.chunk_type,
          chunk.heading_path,
          citationLocator.page_from,
          citationLocator.page_to,
          chunk.char_start,
          chunk.char_end,
          chunk.token_count,
          chunk.content,
          input.asset.title,
          buildChunkMetadataText(chunk.metadata),
          input.embeddings[index],
          JSON.stringify(chunk.metadata),
          JSON.stringify(citationLocator),
        ],
      );
    }

    await client.query(
      `UPDATE knowledge_asset_versions
          SET extraction_status = CASE
                WHEN id = $2 THEN 'ready'
                ELSE 'superseded'
              END,
              superseded_at = CASE
                WHEN id = $2 THEN NULL
                ELSE NOW()
              END
        WHERE asset_id = $1`,
      [input.asset.id, versionId],
    );

    await client.query(
      `UPDATE knowledge_assets
          SET status = 'ready',
              sha256 = $2,
              size_bytes = $3,
              metadata = $4::jsonb,
              updated_at = NOW()
        WHERE id = $1`,
      [
        input.asset.id,
        input.document.source_hash,
        Buffer.byteLength(input.document.normalized_text, "utf8"),
        JSON.stringify(input.document.metadata),
      ],
    );

    return {
      changed: true,
      version_id: versionId,
      version_no: nextVersionNo,
    };
  });
}

export async function enqueueReindexJob(assetId: string, sourceId: string) {
  const result = await pool.query<KnowledgeJobRecord>(
    `INSERT INTO knowledge_jobs (
      id,
      asset_id,
      job_type,
      status,
      attempt_count,
      run_after,
      payload
    ) VALUES (
      $1,
      $2,
      'reindex',
      'queued',
      0,
      NOW(),
      $3::jsonb
    )
    ON CONFLICT (asset_id, job_type)
      WHERE (status IN ('queued', 'running') AND job_type = 'reindex')
    DO UPDATE SET
      payload = EXCLUDED.payload,
      run_after = LEAST(knowledge_jobs.run_after, EXCLUDED.run_after),
      updated_at = NOW(),
      last_error = NULL
    RETURNING *`,
    [
      generateId("job"),
      assetId,
      JSON.stringify({
        source_table: "entries",
        source_id: sourceId,
      }),
    ],
  );

  return mapKnowledgeJob(result.rows[0]);
}

export async function recoverStaleKnowledgeJobs(staleAfterMs: number) {
  if (staleAfterMs <= 0) return 0;

  const result = await pool.query<{ count: number }>(
    `WITH updated AS (
      UPDATE knowledge_jobs
         SET status = 'queued',
             locked_at = NULL,
             worker_id = NULL,
             run_after = NOW(),
             last_error = COALESCE(last_error, 'Recovered stale worker lock.'),
             updated_at = NOW()
       WHERE status = 'running'
         AND locked_at IS NOT NULL
         AND locked_at < NOW() - ($1::text)::interval
       RETURNING 1
    )
    SELECT COUNT(*)::int AS count FROM updated`,
    [`${Math.ceil(staleAfterMs / 1000)} seconds`],
  );

  return result.rows[0]?.count ?? 0;
}

export async function claimNextKnowledgeJob(workerId: string) {
  const result = await withTransaction(async (client) => {
    const claimed = await client.query<KnowledgeJobRecord>(
      `WITH next_job AS (
        SELECT id
          FROM knowledge_jobs
         WHERE status = 'queued'
           AND run_after <= NOW()
         ORDER BY run_after ASC, created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
      )
      UPDATE knowledge_jobs
         SET status = 'running',
             locked_at = NOW(),
             worker_id = $1,
             attempt_count = attempt_count + 1,
             updated_at = NOW()
       WHERE id IN (SELECT id FROM next_job)
       RETURNING *`,
      [workerId],
    );

    return claimed.rows[0] ?? null;
  });

  return result ? mapKnowledgeJob(result) : null;
}

export async function markKnowledgeJobSucceeded(jobId: string, assetVersionId: string | null) {
  await pool.query(
    `UPDATE knowledge_jobs
        SET status = 'succeeded',
            asset_version_id = $2,
            locked_at = NULL,
            worker_id = NULL,
            last_error = NULL,
            updated_at = NOW()
      WHERE id = $1`,
    [jobId, assetVersionId],
  );
}

export async function markKnowledgeJobRetried(
  job: KnowledgeJobRecord,
  status: Extract<KnowledgeJobStatus, "queued" | "dead_letter">,
  errorMessage: string,
  retryDelayMs: number,
) {
  const intervalText = `${Math.max(0, Math.ceil(retryDelayMs / 1000))} seconds`;
  await pool.query(
    `UPDATE knowledge_jobs
        SET status = $2,
            locked_at = NULL,
            worker_id = NULL,
            last_error = $3,
            run_after = CASE
              WHEN $2 = 'queued' THEN NOW() + ($4::text)::interval
              ELSE NOW()
            END,
            updated_at = NOW()
      WHERE id = $1`,
    [job.id, status, errorMessage, intervalText],
  );
}

export async function listEntryIdsForBackfill() {
  const result = await pool.query<{ id: string }>(`
    SELECT e.id
      FROM entries e
      LEFT JOIN knowledge_assets ka
        ON ka.source_table = 'entries'
       AND ka.source_id = e.id
      LEFT JOIN LATERAL (
        SELECT kav.id
          FROM knowledge_asset_versions kav
         WHERE kav.asset_id = ka.id
           AND kav.superseded_at IS NULL
         ORDER BY kav.version_no DESC
         LIMIT 1
      ) current_version ON TRUE
     WHERE ka.id IS NULL
        OR current_version.id IS NULL
        OR (
          ka.status IN ('pending', 'failed', 'processing')
          AND NOT EXISTS (
            SELECT 1
              FROM knowledge_jobs kj
             WHERE kj.asset_id = ka.id
               AND kj.job_type = 'reindex'
               AND kj.status IN ('queued', 'running')
          )
        )
     ORDER BY e.created_at ASC
  `);
  return result.rows.map((row) => row.id);
}

export async function searchEntryKnowledge(options: {
  queryText: string;
  filters: AssistantQueryFilters;
  limit: number;
}) {
  const result = await pool.query<{
    asset_id: string;
    asset_version_id: string;
    chunk_id: string;
    entry_id: string;
    title: string;
    snippet: string;
    score: number;
    metadata: EntryKnowledgeMetadata;
    citation_locator: CitationLocator;
  }>(
    `WITH candidates AS (
      SELECT
        ka.id AS asset_id,
        kav.id AS asset_version_id,
        kc.id AS chunk_id,
        ka.source_id AS entry_id,
        ka.title,
        COALESCE(
          NULLIF(
            replace(
              replace(
                ts_headline(
                  'english',
                  kc.content,
                  plainto_tsquery('english', $1),
                  'MaxWords=28,MinWords=10,MaxFragments=2,StartSel=<<,StopSel=>>'
                ),
                '<<',
                ''
              ),
              '>>',
              ''
            ),
            ''
          ),
          LEFT(kc.content, 280)
        ) AS snippet,
        (
          COALESCE(ts_rank_cd(kc.search_vector, plainto_tsquery('english', $1)), 0) * 1.8
          + GREATEST(similarity(ka.title, $1), 0)
          + CASE WHEN ka.title ILIKE '%' || $1 || '%' THEN 1.2 ELSE 0 END
          + CASE WHEN kc.content ILIKE '%' || $1 || '%' THEN 0.45 ELSE 0 END
        ) AS score,
        kc.metadata,
        kc.citation_locator
      FROM knowledge_chunks kc
      INNER JOIN knowledge_assets ka
        ON ka.id = kc.asset_id
      INNER JOIN knowledge_asset_versions kav
        ON kav.id = kc.asset_version_id
      WHERE ka.source_kind = 'entry'
        AND ka.visibility_scope = 'authenticated'
        AND ka.status = 'ready'
        AND kav.superseded_at IS NULL
        AND (
          cardinality($2::text[]) = 0 OR (ka.metadata ->> 'dept') = ANY($2::text[])
        )
        AND (
          cardinality($3::text[]) = 0 OR (ka.metadata ->> 'type') = ANY($3::text[])
        )
        AND (
          cardinality($4::text[]) = 0 OR (ka.metadata ->> 'priority') = ANY($4::text[])
        )
        AND (
          cardinality($5::text[]) = 0 OR EXISTS (
            SELECT 1
              FROM jsonb_array_elements_text(ka.metadata -> 'tags') AS tag(value)
             WHERE tag.value = ANY($5::text[])
          )
        )
        AND (
          kc.search_vector @@ plainto_tsquery('english', $1)
          OR ka.title ILIKE '%' || $1 || '%'
          OR kc.content ILIKE '%' || $1 || '%'
          OR similarity(ka.title, $1) > 0.15
        )
    ),
    top_per_asset AS (
      SELECT DISTINCT ON (asset_id)
        asset_id,
        asset_version_id,
        chunk_id,
        entry_id,
        title,
        snippet,
        score,
        metadata,
        citation_locator
      FROM candidates
      ORDER BY asset_id, score DESC, chunk_id
    )
    SELECT
      asset_id,
      asset_version_id,
      chunk_id,
      entry_id,
      title,
      snippet,
      score,
      metadata,
      citation_locator
    FROM top_per_asset
    ORDER BY score DESC, title ASC
    LIMIT $6`,
    [
      options.queryText,
      options.filters.departments,
      options.filters.entry_types,
      options.filters.priorities,
      options.filters.tags,
      options.limit,
    ],
  );

  return result.rows.map(mapSearchResult);
}
