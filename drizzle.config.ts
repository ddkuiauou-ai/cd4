import { defineConfig } from "drizzle-kit";

// Generating and checking migrations must work without database credentials.
export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema-postgres.ts",
  dialect: "postgresql",
  migrations: {
    schema: "drizzle",
    table: "__drizzle_migrations",
  },
});
