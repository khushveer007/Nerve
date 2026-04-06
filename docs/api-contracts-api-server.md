# Nerve - API Contracts (`api-server`)

**Date:** 2026-04-06
**Part:** `api-server`

## Overview

The active backend exposes a compact REST API under `/api`. It uses cookie-based session auth, JSON request bodies, and JSON responses. All routes except `/api/health` and `/api/auth/*` require an authenticated session.

## Global Rules

### Authentication

- Public:
  - `GET /api/health`
  - `GET /api/auth/me`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
- Authenticated:
  - everything else under `/api`

### Response Shape Conventions

- Successful reads return named payloads such as `{ user }`, `{ entries }`, `{ teams }`
- Successful destructive actions return `{ ok: true }`
- Validation, auth, and domain errors return `{ message: string }`

### Common Error Statuses

| Status | Meaning | Typical Cases |
| --- | --- | --- |
| `400` | Invalid request or business rule violation | Bad payload, self-delete attempt, deleting a team with assigned users |
| `401` | Authentication required or invalid credentials | Missing session, bad email/password |
| `403` | Permission denied | Insufficient role/team permissions |
| `404` | Record not found | Missing user or branding row on update |
| `409` | Conflict | Duplicate user email or team slug |
| `500` | Internal server error | Unhandled server exception |

## Endpoint Catalog

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Health probe |
| `GET` | `/api/auth/me` | Public | Restore current session user |
| `POST` | `/api/auth/login` | Public | Sign in and create session |
| `POST` | `/api/auth/logout` | Public | Destroy session |
| `GET` | `/api/bootstrap` | Session | Fetch entries, users, teams, and optionally branding rows |
| `GET` | `/api/assistant/health` | Session | Report backend and corpus readiness for the assistant shell |
| `POST` | `/api/assistant/query` | Session | Route and retrieve against the Phase 1 entry-backed corpus |
| `POST` | `/api/assistant/source-preview` | Session | Load a permission-safe assistant source preview |
| `POST` | `/api/assistant/source-open` | Session | Resolve an authorized assistant source open target |
| `GET` | `/api/entries` | Session | List entries |
| `POST` | `/api/entries` | Session | Create entry |
| `PATCH` | `/api/entries/:id` | Session | Update entry and trigger reindexing |
| `DELETE` | `/api/entries/:id` | Session | Delete entry |
| `GET` | `/api/users` | Session | List users |
| `POST` | `/api/users` | Session | Create user with role/team restrictions |
| `PATCH` | `/api/users/:id` | Session | Update user (super admin only) |
| `DELETE` | `/api/users/:id` | Session | Delete user (super admin only) |
| `GET` | `/api/teams` | Session | List teams |
| `POST` | `/api/teams` | Session | Create team (super admin only) |
| `DELETE` | `/api/teams/:id` | Session | Delete team (super admin only) |
| `GET` | `/api/branding-rows` | Session | List branding rows for branding managers |
| `POST` | `/api/branding-rows` | Session | Create branding row |
| `PATCH` | `/api/branding-rows/:id` | Session | Update branding row |
| `DELETE` | `/api/branding-rows/:id` | Session | Delete branding row |

## Auth Endpoints

### `GET /api/auth/me`

- **Purpose:** Restore the current session user.
- **Auth:** Public endpoint; returns `null` when not logged in.
- **Response:** `{ "user": AppUser | null }`

### `POST /api/auth/login`

- **Purpose:** Validate credentials and create a session.
- **Request Body:**

```json
{
  "email": "user@parul.ac.in",
  "password": "secret"
}
```

- **Validation:** `email` must be a valid email; `password` must be non-empty.
- **Success Response:** `{ "user": AppUser }`
- **Failure:** `401` for invalid credentials

### `POST /api/auth/logout`

- **Purpose:** Destroy the session and clear `connect.sid`.
- **Response:** `{ "ok": true }`

## Bootstrap Endpoint

### `GET /api/bootstrap`

- **Purpose:** Load the main application payload after login.
- **Auth:** Any authenticated user.
- **Response:**

```json
{
  "entries": [],
  "users": [],
  "teams": [],
  "brandingRows": []
}
```

- **Notes:** `brandingRows` is populated only when `isBrandingManager()` returns true; otherwise it resolves to an empty array.

## Entries

## Assistant

### `GET /api/assistant/health`

- **Purpose:** Tell the authenticated assistant workspace whether the backend is healthy and whether the entry corpus is ready or still warming up.
- **Auth:** Any authenticated user.
- **Success Response:**

```json
{
  "available": true,
  "title": "Assistant is available.",
  "description": "Entry-backed search is live with indexed knowledge assets.",
  "nextStep": "Submit a query to search the Phase 1 entry corpus."
}
```

- **Failure Shape:** `{ "message": string }`

### `POST /api/assistant/query`

- **Purpose:** Execute the routed Phase 1 assistant query path over entry-backed `knowledge_*` records.
- **Auth:** Any authenticated user.
- **Authorization Notes:** Retrieval is request-scoped and ACL-aware. The assistant evaluates the current session user, role, team, asset ownership, `visibility_scope`, and `knowledge_acl_principals` before it shapes snippets, citations, counts, or actions.
- **Request Body:**

```json
{
  "query": {
    "mode": "auto",
    "text": "NABH accreditation",
    "filters": {
      "departments": [],
      "entry_types": [],
      "priorities": [],
      "tags": []
    }
  }
}
```

- **Response:**

```json
{
  "result": {
    "mode": "search",
    "answer": null,
    "enough_evidence": true,
    "grounded": false,
    "citations": [],
    "results": [
      {
        "asset_id": "asset_123",
        "asset_version_id": "assetver_123",
        "chunk_id": "chunk_123",
        "entry_id": "e-001",
        "title": "Medical College Gets NABH Accreditation",
        "source_kind": "entry",
        "media_type": "text",
        "snippet": "Parul Institute of Medical Sciences and Research has been granted NABH accreditation...",
        "score": 2.17,
        "actions": {
          "preview": {
            "available": true
          },
          "open_source": {
            "available": true
          }
        },
        "metadata": {
          "dept": "Medical",
          "type": "Achievement",
          "priority": "Key highlight"
        }
      }
    ],
    "follow_up_suggestions": [
      "Refine the query with a department or title phrase."
    ],
    "request_id": "req_123"
  }
}
```

- **Notes:**
  - `result.mode` is the resolved server mode. Explicit `search` and `ask` selections stay authoritative, while `auto` is routed deterministically to `search` or `ask`.
  - Story 1.4 still keeps `answer` as `null` and `grounded` as `false`; routed `ask` turns stay evidence-led until grounded synthesis lands in a later story.
  - Results are limited to `source_kind = "entry"` in this Phase 1 slice.
  - Retrieval uses an ACL-safe hybrid pipeline across metadata-aware exact matching, PostgreSQL full-text search, trigram similarity, and vector similarity when query embeddings are configured.
  - If `ASSISTANT_EMBEDDING_URL` is not configured, the route degrades safely to metadata + FTS + trigram retrieval without changing the response shape.
  - Unauthorized assets are excluded before snippets, citations, and follow-up guidance are assembled.
  - Blocked sources do not appear as disabled cards, teaser actions, hidden counts, or partial metadata.

### `POST /api/assistant/source-preview`

- **Purpose:** Return the minimum permission-safe preview payload required for the assistant evidence/context surface.
- **Auth:** Any authenticated user.
- **Request Body:**

```json
{
  "preview": {
    "source": {
      "asset_id": "asset_123",
      "asset_version_id": "assetver_123",
      "chunk_id": "chunk_123",
      "entry_id": "e-001",
      "source_kind": "entry"
    }
  }
}
```

- **Success Response:**

```json
{
  "preview": {
    "source": {
      "asset_id": "asset_123",
      "asset_version_id": "assetver_123",
      "chunk_id": "chunk_123",
      "entry_id": "e-001",
      "source_kind": "entry"
    },
    "title": "Medical College Gets NABH Accreditation",
    "excerpt": "Parul Institute of Medical Sciences and Research has been granted NABH accreditation...",
    "metadata": {
      "dept": "Medical",
      "type": "Achievement",
      "priority": "Key highlight"
    },
    "open_target": {
      "kind": "internal",
      "path": "/browse?assistantEntryId=e-001",
      "label": "Open in Browse entries"
    }
  }
}
```

- **Failure Cases:**
  - `400` for malformed payload wrappers
  - `403` with `{ "message": "You are not authorized to access that source." }` when the session actor is not allowed to preview the asset

### `POST /api/assistant/source-open`

- **Purpose:** Resolve an authorized internal source-open target without exposing a public file or upload URL.
- **Auth:** Any authenticated user.
- **Request Body:**

```json
{
  "open": {
    "source": {
      "asset_id": "asset_123",
      "asset_version_id": "assetver_123",
      "chunk_id": "chunk_123",
      "entry_id": "e-001",
      "source_kind": "entry"
    }
  }
}
```

- **Success Response:**

```json
{
  "open": {
    "source": {
      "asset_id": "asset_123",
      "asset_version_id": "assetver_123",
      "chunk_id": "chunk_123",
      "entry_id": "e-001",
      "source_kind": "entry"
    },
    "target": {
      "kind": "internal",
      "path": "/browse?assistantEntryId=e-001",
      "label": "Open in Browse entries"
    }
  }
}
```

- **Failure Cases:**
  - `400` for malformed payload wrappers
  - `403` with `{ "message": "You are not authorized to access that source." }` when the session actor is not allowed to open the asset

### `GET /api/entries`

- **Purpose:** List all entries ordered by `created_at DESC`.
- **Auth:** Any authenticated user.
- **Response:** `{ "entries": Entry[] }`

### `POST /api/entries`

- **Purpose:** Create a new knowledge entry.
- **Auth:** Any authenticated user.
- **Request Body:**

```json
{
  "title": "Entry title",
  "dept": "Engineering",
  "type": "Research",
  "body": "Detailed description",
  "priority": "High",
  "entry_date": "2026-04-02",
  "created_by": null,
  "tags": ["research"],
  "author_name": "Dr. Name",
  "academic_year": "2025-26",
  "student_count": 120,
  "external_link": "",
  "collaborating_org": ""
}
```

- **Validation Notes:**
  - `priority` must be one of `Normal`, `High`, `Key highlight`
  - `tags` must be an array of strings
  - `created_by` in the payload is ignored in practice because the handler overwrites it with the current session user id
- **Success Response:** `{ "entry": Entry }`

### `PATCH /api/entries/:id`

- **Purpose:** Update an existing entry and enqueue a shared reindex job for the RAG layer.
- **Auth:** Any authenticated user.
- **Request Body:** any subset of entry-create fields except `created_by`
- **Success Response:** `{ "entry": Entry }`
- **Failure Cases:**
  - `400` for invalid partial payloads
  - `404` when the entry id does not exist

### `DELETE /api/entries/:id`

- **Purpose:** Delete an entry by id.
- **Auth:** Any authenticated user.
- **Response:** `{ "ok": true }`

## Users

### `GET /api/users`

- **Purpose:** List all users ordered by creation time.
- **Auth:** Any authenticated user.
- **Response:** `{ "users": AppUser[] }`

### `POST /api/users`

- **Purpose:** Create a user.
- **Auth:** `super_admin`, or `admin` within strict team/role limits.
- **Request Body:**

```json
{
  "full_name": "New User",
  "email": "new@parul.ac.in",
  "password": "secret",
  "department": "Engineering",
  "role": "user",
  "team": "branding",
  "managed_by": "bs-001"
}
```

- **Authorization Rules:**
  - `super_admin` can create anyone
  - `admin` can create only `sub_admin` or `user`
  - `admin` must assign the new user to the same team as the acting admin
- **Failure Cases:**
  - `403` when the actor is not allowed to create that user
  - `409` when the email already exists
- **Success Response:** `{ "user": AppUser }`

### `PATCH /api/users/:id`

- **Purpose:** Update user profile, role, team, or password.
- **Auth:** `super_admin` only.
- **Request Body:** partial fields from the create schema
- **Success Response:** `{ "user": AppUser }`

### `DELETE /api/users/:id`

- **Purpose:** Delete a user.
- **Auth:** `super_admin` only.
- **Business Rules:**
  - cannot delete the currently logged-in super admin
  - clears `managed_by` references before deletion
- **Response:** `{ "ok": true }`

## Teams

### `GET /api/teams`

- **Purpose:** List built-in and custom teams.
- **Auth:** Any authenticated user.
- **Response:** `{ "teams": TeamRecord[] }`

### `POST /api/teams`

- **Purpose:** Create a custom team.
- **Auth:** `super_admin` only.
- **Request Body:**

```json
{
  "name": "Admissions",
  "color": "violet"
}
```

- **Failure:** `409` when the slugified team id already exists
- **Success Response:** `{ "team": TeamRecord }`

### `DELETE /api/teams/:id`

- **Purpose:** Delete a team.
- **Auth:** `super_admin` only.
- **Business Rule:** returns `400` if any user is still assigned to that team
- **Response:** `{ "ok": true }`

## Branding Rows

Branding rows are available only to branding managers: `super_admin` or any user on the `branding` team.

### `GET /api/branding-rows`

- **Purpose:** List branding rows ordered by creation time.
- **Response:** `{ "brandingRows": BrandingRow[] }`

### `POST /api/branding-rows`

- **Purpose:** Create a branding row.
- **Request Body:** all fields are optional strings and default to `""`

```json
{
  "category": "Campaign",
  "sub_category": "Engineering",
  "time_taken": "2h",
  "team_member": "Jane",
  "project_name": "Open Day",
  "additional_info": "Social assets delivered"
}
```

- **Success Response:** `{ "brandingRow": BrandingRow }`

### `PATCH /api/branding-rows/:id`

- **Purpose:** Update an existing branding row.
- **Response:** `{ "brandingRow": BrandingRow }`
- **Failure:** `404` if the row does not exist

### `DELETE /api/branding-rows/:id`

- **Purpose:** Delete a branding row.
- **Response:** `{ "ok": true }`

## Brownfield Notes

- The API contract is intentionally compact and currently favors broad list endpoints over paginated or filtered queries.
- There is no file-upload endpoint even though attachment metadata exists in the active entry model.
- If the retained Supabase path is reactivated, its contract will need reconciliation with the active Express role and data model first.

---

_Generated using BMAD Method `document-project` workflow_
