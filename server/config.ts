import { DEFAULT_SUPER_ADMIN_EMAIL, LEGACY_SUPER_ADMIN_PASSWORD } from "./seed.js";

function requireEnv(key: string) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string) {
  return process.env[key]?.trim() || "";
}

function getBooleanEnv(key: string, fallback: boolean) {
  const rawValue = process.env[key]?.trim().toLowerCase();
  if (!rawValue) return fallback;
  if (["true", "1", "yes", "on"].includes(rawValue)) return true;
  if (["false", "0", "no", "off"].includes(rawValue)) return false;
  return fallback;
}

function getNumberEnv(key: string, fallback: number) {
  const rawValue = process.env[key]?.trim();
  if (!rawValue) return fallback;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const databaseUrl = requireEnv("DATABASE_URL");
const sessionSecret = requireEnv("SESSION_SECRET");
const superAdminPassword = requireEnv("SUPER_ADMIN_PASSWORD");
const assistantEmbeddingDimensions = getNumberEnv("ASSISTANT_EMBEDDING_DIMENSIONS", 1536);

if (superAdminPassword === LEGACY_SUPER_ADMIN_PASSWORD) {
  throw new Error("SUPER_ADMIN_PASSWORD must not use the legacy default password.");
}

if (!Number.isInteger(assistantEmbeddingDimensions) || assistantEmbeddingDimensions !== 1536) {
  throw new Error(
    "ASSISTANT_EMBEDDING_DIMENSIONS must be 1536 to match the current knowledge_chunks.embedding schema.",
  );
}

export const config = {
  apiPort: Number(process.env.API_PORT || 3001),
  appBaseUrl: process.env.APP_BASE_URL || "http://127.0.0.1",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  databaseUrl,
  sessionSecret,
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL?.trim() || DEFAULT_SUPER_ADMIN_EMAIL,
  superAdminPassword,
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "noreply@parul.ac.in",
  },
  assistant: {
    enabled: getBooleanEnv("ASSISTANT_RAG_ENABLED", true),
    queryResultLimit: getNumberEnv("ASSISTANT_QUERY_RESULT_LIMIT", 5),
    embeddings: {
      url: optionalEnv("ASSISTANT_EMBEDDING_URL"),
      apiKey: optionalEnv("ASSISTANT_EMBEDDING_API_KEY"),
      authHeader: optionalEnv("ASSISTANT_EMBEDDING_API_HEADER")
        || (optionalEnv("ASSISTANT_EMBEDDING_API_KEY") ? "Authorization" : ""),
      authScheme: optionalEnv("ASSISTANT_EMBEDDING_AUTH_SCHEME")
        || (
          (
            optionalEnv("ASSISTANT_EMBEDDING_API_HEADER")
            || (optionalEnv("ASSISTANT_EMBEDDING_API_KEY") ? "Authorization" : "")
          ) === "Authorization"
            ? "Bearer"
            : ""
        ),
      model: optionalEnv("ASSISTANT_EMBEDDING_MODEL") || "text-embedding-3-small",
      dimensions: assistantEmbeddingDimensions,
    },
    worker: {
      pollIntervalMs: getNumberEnv("ASSISTANT_WORKER_POLL_MS", 1_000),
      maxAttempts: getNumberEnv("ASSISTANT_JOB_MAX_ATTEMPTS", 3),
      retryBaseMs: getNumberEnv("ASSISTANT_JOB_RETRY_BASE_MS", 15_000),
      staleLockMs: getNumberEnv("ASSISTANT_JOB_STALE_LOCK_MS", 60_000),
    },
  },
};
