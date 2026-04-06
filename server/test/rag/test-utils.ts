import { randomBytes } from "node:crypto";
import { createServer, type RequestListener, type Server } from "node:http";
import { Pool } from "pg";
import { vi } from "vitest";

const ENV_KEYS = [
  "APP_BASE_URL",
  "COOKIE_SECURE",
  "DATABASE_URL",
  "SESSION_SECRET",
  "SUPER_ADMIN_EMAIL",
  "SUPER_ADMIN_PASSWORD",
  "ASSISTANT_RAG_ENABLED",
  "ASSISTANT_QUERY_RESULT_LIMIT",
  "ASSISTANT_EMBEDDING_URL",
  "ASSISTANT_EMBEDDING_API_KEY",
  "ASSISTANT_EMBEDDING_API_HEADER",
  "ASSISTANT_EMBEDDING_AUTH_SCHEME",
  "ASSISTANT_EMBEDDING_DIMENSIONS",
  "ASSISTANT_EMBEDDING_TIMEOUT_MS",
  "ASSISTANT_EMBEDDING_MAX_QUERY_DISTANCE",
  "ASSISTANT_ANSWER_URL",
  "ASSISTANT_ANSWER_API_KEY",
  "ASSISTANT_ANSWER_API_HEADER",
  "ASSISTANT_ANSWER_AUTH_SCHEME",
  "ASSISTANT_ANSWER_MODEL",
  "ASSISTANT_ANSWER_TIMEOUT_MS",
  "ASSISTANT_JOB_MAX_ATTEMPTS",
  "ASSISTANT_JOB_RETRY_BASE_MS",
  "ASSISTANT_WORKER_POLL_MS",
  "ASSISTANT_JOB_STALE_LOCK_MS",
];

function buildDatabaseUrl(baseConnectionString: string, databaseName: string) {
  const url = new URL(baseConnectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

export async function createTestRuntime(envOverrides: Record<string, string> = {}) {
  const baseConnectionString = envOverrides.TEST_DATABASE_URL
    || process.env.TEST_DATABASE_URL
    || process.env.DATABASE_URL;

  if (!baseConnectionString) {
    throw new Error("DATABASE_URL or TEST_DATABASE_URL is required to run server RAG tests.");
  }

  const previousEnv = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) {
    previousEnv.set(key, process.env[key]);
  }

  const adminUrl = new URL(baseConnectionString);
  adminUrl.pathname = "/postgres";

  const adminPool = new Pool({ connectionString: adminUrl.toString() });
  const databaseName = `nerve_test_${Date.now()}_${randomBytes(3).toString("hex")}`;
  await adminPool.query(`CREATE DATABASE "${databaseName}"`);

  const connectionString = buildDatabaseUrl(baseConnectionString, databaseName);
  Object.assign(process.env, {
    APP_BASE_URL: "http://127.0.0.1:8080",
    COOKIE_SECURE: "false",
    DATABASE_URL: connectionString,
    SESSION_SECRET: "test-session-secret",
    SUPER_ADMIN_EMAIL: "super@parul.ac.in",
    SUPER_ADMIN_PASSWORD: "Test-Password-123!",
    ASSISTANT_RAG_ENABLED: "true",
    ASSISTANT_QUERY_RESULT_LIMIT: "20",
    ASSISTANT_EMBEDDING_URL: "",
    ASSISTANT_EMBEDDING_API_KEY: "",
    ASSISTANT_EMBEDDING_API_HEADER: "Authorization",
    ASSISTANT_EMBEDDING_AUTH_SCHEME: "Bearer",
    ASSISTANT_EMBEDDING_DIMENSIONS: "1536",
    ASSISTANT_EMBEDDING_TIMEOUT_MS: "3000",
    ASSISTANT_EMBEDDING_MAX_QUERY_DISTANCE: "0.35",
    ASSISTANT_ANSWER_URL: "",
    ASSISTANT_ANSWER_API_KEY: "",
    ASSISTANT_ANSWER_API_HEADER: "Authorization",
    ASSISTANT_ANSWER_AUTH_SCHEME: "Bearer",
    ASSISTANT_ANSWER_MODEL: "gpt-4.1-mini",
    ASSISTANT_ANSWER_TIMEOUT_MS: "5000",
    ASSISTANT_JOB_MAX_ATTEMPTS: "2",
    ASSISTANT_JOB_RETRY_BASE_MS: "0",
    ASSISTANT_WORKER_POLL_MS: "0",
    ASSISTANT_JOB_STALE_LOCK_MS: "1000",
    ...envOverrides,
  });

  vi.resetModules();

  const dbModule = await import("../../db.js");
  const ragDbModule = await import("../../rag/db.js");
  const jobsModule = await import("../../rag/jobs.js");
  const serviceModule = await import("../../rag/service.js");

  async function cleanup() {
    await dbModule.pool.end();
    vi.resetModules();

    await adminPool.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()`,
      [databaseName],
    );
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await adminPool.end();

    for (const key of ENV_KEYS) {
      const previousValue = previousEnv.get(key);
      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    }
  }

  return {
    connectionString,
    cleanup,
    modules: {
      db: dbModule,
      ragDb: ragDbModule,
      jobs: jobsModule,
      service: serviceModule,
    },
  };
}

export async function drainKnowledgeJobs(
  jobsModule: typeof import("../../rag/jobs.js"),
  limit = 100,
) {
  let processed = 0;

  while (processed < limit) {
    const next = await jobsModule.processNextKnowledgeJob("test-rag-worker");
    if (!next) return processed;
    processed += 1;
  }

  throw new Error(`Exceeded the knowledge job drain limit of ${limit}.`);
}

export async function startHttpServer(app: RequestListener) {
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine test server address.");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

export async function stopHttpServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function loginAndGetSessionCookie(
  baseUrl: string,
  credentials: { email: string; password: string } = {
    email: process.env.SUPER_ADMIN_EMAIL!,
    password: process.env.SUPER_ADMIN_PASSWORD!,
  },
) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}.`);
  }

  const cookie = response.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("Login response did not include a session cookie.");
  }

  return cookie;
}
