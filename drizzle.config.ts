import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

const requiredEnvVars = [
  "POSTGRES_HOST",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} is not set`);
  }
}

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema-postgres.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.POSTGRES_HOST!,
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    user: process.env.POSTGRES_USER!,
    password: process.env.POSTGRES_PASSWORD!,
    database: process.env.POSTGRES_DB!,
    ssl: false,
  },
});

// export default defineConfig({
//   out: "./drizzle",
//   schema: "./db/schema-postgres.ts",
//   dialect: "postgresql",
//   dbCredentials: {
//     url: process.env.ONLY_FOR_DRIZZLE_SCHEMA_CHECK!,
//   },
// });

// if (!process.env.TURSO_DATABASE_URL) {
//   throw new Error("TURSO_DATABASE_URL is not set");
// }
// if (!process.env.TURSO_AUTH_TOKEN) {
//   throw new Error("TURSO_AUTH_TOKEN is not set");
// }

// if (!process.env.TURSO_DATABASE_URL) {
//   throw new Error("TURSO_DATABASE_URL is not set");
// }
// if (!process.env.TURSO_AUTH_TOKEN) {
//   throw new Error("TURSO_AUTH_TOKEN is not set");
// }

// export default defineConfig({
//   out: "./drizzle",
//   schema: "./db/schema-turso.ts",
//   dialect: "turso",
//   dbCredentials: {
//     url: process.env.TURSO_DATABASE_URL,
//     authToken: process.env.TURSO_AUTH_TOKEN,
//   },
// });

// unset $(cat.env | grep - v '^#' | cut - d= -f1)