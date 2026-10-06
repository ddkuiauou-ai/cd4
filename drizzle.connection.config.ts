import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import schemaConfig from "./drizzle.config";
import { getPostgresConnection } from "./db/connection";

config({ path: ".env", quiet: true });

export default defineConfig({
  ...schemaConfig,
  dialect: "postgresql",
  dbCredentials: getPostgresConnection(process.env),
});
