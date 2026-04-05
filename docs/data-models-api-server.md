# Nerve - Data Models (`api-server`)

**Date:** 2026-04-05
**Part:** `api-server`

## Overview

Nerve currently has three related data-model layers in the repository:

1. **Active PostgreSQL schema** created by `server/db.ts`
2. **Legacy browser-side localStorage schema** in `src/lib/db.ts`
3. **Retained Supabase schema** in `supabase/migrations/`

The active product path is the Express/PostgreSQL schema. The localStorage and Supabase models remain important because they explain legacy files and future migration considerations.

## Active PostgreSQL Schema

### `teams`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT` | Primary key; slug such as `branding` |
| `name` | `TEXT` | Display name |
| `color` | `TEXT` | UI color token |
| `is_built_in` | `BOOLEAN` | Distinguishes seeded teams |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |

**Notes:** Seeded with `branding` and `content` when empty.

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT` | Primary key |
| `full_name` | `TEXT` | Required |
| `email` | `TEXT` | Unique |
| `department` | `TEXT` | Defaults to empty string |
| `role` | `TEXT` | `super_admin`, `admin`, `sub_admin`, `user` |
| `team` | `TEXT` | FK to `teams(id)`, nullable |
| `managed_by` | `TEXT` | Self-reference to `users(id)`, nullable |
| `password_hash` | `TEXT` | Salted scrypt hash |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Default `NOW()` |

**Relationships:**

- `team -> teams.id`
- `managed_by -> users.id`

### `entries`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT` | Primary key |
| `title` | `TEXT` | Required |
| `dept` | `TEXT` | Required department label |
| `type` | `TEXT` | Required content type |
| `body` | `TEXT` | Main narrative body |
| `priority` | `TEXT` | `Normal`, `High`, `Key highlight` |
| `entry_date` | `DATE` | Business date |
| `created_by` | `TEXT` | FK to `users(id)`, nullable |
| `tags` | `TEXT[]` | Defaults to empty array |
| `author_name` | `TEXT` | Defaults to empty string |
| `academic_year` | `TEXT` | Defaults to empty string |
| `student_count` | `INTEGER` | Nullable |
| `external_link` | `TEXT` | Defaults to empty string |
| `collaborating_org` | `TEXT` | Defaults to empty string |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |
| `attachments` | `JSONB` | Defaults to `[]` |

**Relationships:**

- `created_by -> users.id`

**Notes:** The active API keeps attachment metadata inline in `entries.attachments` rather than a separate table.

### `branding_rows`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT` | Primary key |
| `category` | `TEXT` | Defaults to empty string |
| `sub_category` | `TEXT` | Defaults to empty string |
| `time_taken` | `TEXT` | Defaults to empty string |
| `team_member` | `TEXT` | Defaults to empty string |
| `project_name` | `TEXT` | Defaults to empty string |
| `additional_info` | `TEXT` | Defaults to empty string |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Default `NOW()` |

### `session` (implicit)

The session table is managed by `connect-pg-simple` and is not declared directly in repo SQL, but it is part of the active runtime schema because Express sessions persist into PostgreSQL.

## RAG Knowledge Schema

Story 1.2 adds a migration-managed retrieval layer in `server/migrations/` and `server/rag/`. These tables are derived from the business records in `entries`; they do not replace the authoritative CRUD schema in `server/db.ts`.

### `knowledge_assets`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT` | Primary key |
| `source_kind` | `TEXT` | `entry`, `uploaded_file`, `branding_record` |
| `source_table` | `TEXT` | Phase 1 uses `entries` |
| `source_id` | `TEXT` | Business-row foreign key by convention |
| `title` | `TEXT` | Search/display title |
| `mime_type` | `TEXT` | Phase 1 entries use `text/markdown` |
| `media_type` | `TEXT` | `text`, `pdf`, `image`, `doc` |
| `visibility_scope` | `TEXT` | Defaults to `authenticated` for entries |
| `status` | `TEXT` | `pending`, `processing`, `ready`, `failed`, `deleted` |
| `metadata` | `JSONB` | Preserves ranking/filtering metadata such as `dept`, `type`, `tags`, `entry_date`, `priority`, and related fields |
| `sha256` | `TEXT` | Source hash of the current indexed content |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | Lifecycle timestamps |

### `knowledge_asset_versions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT` | Primary key |
| `asset_id` | `TEXT` | FK to `knowledge_assets(id)` |
| `version_no` | `INTEGER` | Monotonic per asset |
| `source_hash` | `TEXT` | Used to skip unchanged reindexes |
| `extractor_model` | `TEXT` | `entry-phase-1` or the configured embedding model |
| `extraction_status` | `TEXT` | `processing`, `ready`, `failed`, `superseded` |
| `normalized_markdown` | `TEXT` | Versioned normalized representation |
| `normalized_text` | `TEXT` | Search/index source text |
| `structural_metadata` | `JSONB` | Chunking/structure summary |
| `superseded_at` | `TIMESTAMPTZ` | Null for the current searchable version |

### `knowledge_chunks`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT` | Primary key |
| `asset_version_id` | `TEXT` | FK to `knowledge_asset_versions(id)` |
| `asset_id` | `TEXT` | FK to `knowledge_assets(id)` |
| `chunk_no` | `INTEGER` | Sequence within a version |
| `chunk_type` | `TEXT` | Phase 1 uses `body` |
| `heading_path` | `TEXT[]` | Citation-friendly section labels |
| `content` | `TEXT` | Entry chunk text; first chunk includes title plus key metadata |
| `search_vector` | `TSVECTOR` | Weighted full-text search representation |
| `embedding` | `VECTOR(1536)` | Nullable until an embedding endpoint is configured |
| `metadata` | `JSONB` | Chunk-local metadata for ranking/filtering |
| `citation_locator` | `JSONB` | Machine-usable citation trace |

### `knowledge_acl_principals`

Explicit ACL rows reserved for later non-default visibility scopes.

### `knowledge_jobs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT` | Primary key |
| `asset_id` | `TEXT` | FK to `knowledge_assets(id)` |
| `asset_version_id` | `TEXT` | Nullable FK to `knowledge_asset_versions(id)` |
| `job_type` | `TEXT` | Includes `reindex` in the Phase 1 implementation |
| `status` | `TEXT` | `queued`, `running`, `succeeded`, `failed`, `dead_letter` |
| `attempt_count` | `INTEGER` | Retry counter |
| `run_after` | `TIMESTAMPTZ` | Backoff scheduling point |
| `locked_at` | `TIMESTAMPTZ` | Worker-claim timestamp |
| `worker_id` | `TEXT` | Current worker identifier |
| `last_error` | `TEXT` | Latest failure detail |
| `payload` | `JSONB` | Source reference for reindex jobs |

### `rag_schema_migrations`

Tracks the applied SQL migration filenames for the RAG layer. The API and worker both run the migration runner before serving traffic or jobs.

## Active Seed Data

### Built-In Teams

- `branding`
- `content`

### Seeded Roles

- `super_admin`
- `admin`
- `sub_admin`
- `user`

### Seeded Domain Records

- Sample users for each role/team combination
- Sample knowledge entries across departments and content types

## Legacy Browser-Side Schema (`src/lib/db.ts`)

These models power older unrouted pages and are persisted into localStorage:

| Local Key | Entity | Notes |
| --- | --- | --- |
| `pu_entries` | `Entry[]` | Mirrors many active API fields and includes inline `attachments` |
| `pu_users` | `UserRecord[]` | Includes role, team, and `managed_by` |
| `pu_teams` | `TeamRecord[]` | Stores only custom teams; built-ins are hardcoded |
| `pu_branding_rows` | `BrandingTableRow[]` | Legacy branding-row collection |

**Important:** This schema is useful historical context, but it is not the active source of truth for routed pages.

## Retained Supabase Schema

The retained Supabase migration defines:

### Enum

- `public.app_role`: `admin`, `editor`, `viewer`

### Tables

| Table | Purpose |
| --- | --- |
| `user_roles` | Maps auth users to retained role enum values |
| `profiles` | User profile metadata tied to `auth.users` |
| `entries` | Knowledge entries with `updated_at` trigger |
| `attachments` | Separate attachment table tied to storage objects |

### Functions And Policies

- `has_role(_user_id, _role)` authorization helper
- `handle_new_user()` trigger to create profile + default `editor` role
- RLS policies for profiles, roles, entries, attachments, and storage bucket access

### Storage

- Bucket: `attachments`

## Schema Drift To Watch

The retained Supabase schema and the active API schema diverge in several important ways:

| Area | Active API | Retained Supabase |
| --- | --- | --- |
| Roles | `super_admin`, `admin`, `sub_admin`, `user` | `admin`, `editor`, `viewer` |
| Team support | Explicit `teams` table and `users.team` | No team table |
| Branding rows | Present | Absent |
| Attachments | Inline JSONB on `entries` | Separate `attachments` table + storage bucket |
| Session model | Express sessions in PostgreSQL | Supabase auth users and RLS |

This drift means any attempt to reconnect the frontend to Supabase will require an explicit domain and auth reconciliation step first.

## Brownfield Guidance

- For current backend feature work, treat the Express/PostgreSQL schema as the source of truth.
- Treat `knowledge_*` tables as derived retrieval structures fed from `entries`; business CRUD should continue to target `entries`.
- Use the localStorage schema only when cleaning up or migrating legacy unrouted screens.
- Use the retained Supabase schema as reference material for historical intent, not as an exact contract for the current runtime.

---

_Generated using BMAD Method `document-project` workflow_
