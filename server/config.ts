const required = ["DATABASE_URL", "SESSION_SECRET"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  apiPort: Number(process.env.API_PORT || 3001),
  appBaseUrl: process.env.APP_BASE_URL || "http://127.0.0.1",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  databaseUrl: process.env.DATABASE_URL!,
  sessionSecret: process.env.SESSION_SECRET!,
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || "super@parul.ac.in",
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || "super123",
};
